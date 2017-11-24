'use strict';

const { expect } = require('chai');
const async = require('async');
const netgen = require('./fixtures/node-generator');
const orc = require('../index');


describe('@module orc (end-to-end)', function() {

  const NUM_NODES = 12;
  const nodes = [];
  const shard = Buffer.from('i am a test shard');
  const audit = new orc.Audit(4);
  const capacities = [];

  let contract = null;

  before(function(done) {
    this.timeout(12000);
    netgen(12, (n) => {
      n.forEach((node) => nodes.push(node));
      async.eachSeries(nodes, (n, done) => {
        n.listen(n.contact.port, n.contact.hostname, done)
      }, () => {
        audit.on('finish', done).end(shard);
      });
    });
  });

  after(function(done) {
    this.timeout(12000);
    setTimeout(() => {
      async.each(nodes, (n, next) => {
        n.transport.server.close();
        next();
      }, done);
    }, 4000);
  });

  it('should join all nodes together', function(done) {
    this.timeout(6000);
    async.eachOfSeries(nodes, (n, i, next) => {
      if (i === 0) {
        next();
      } else {
        n.join([
          nodes[0].identity.toString('hex'),
          nodes[0].contact
        ], () => next());
      }
    }, () => {
      nodes.forEach((n) => {
        expect(n.router.size > 0.75 / NUM_NODES).to.equal(true);
      });
      done();
    });
  });

  it('should succeed in subscribing to capacity', function(done) {
    this.timeout(24000);
    let received = 0;
    const renter = nodes[0];
    const farmer = nodes[1];
    renter.subscribeCapacityAnnouncement((err, stream) => {
      stream.on('data', (data) => {
        capacities.push(data);
        expect(capacities[0][0].available).to.equal(shard.length);
        received++;
        if (received === 2) {
          done();
        }
      });
    });
    setTimeout(() => {
      farmer.publishCapacityAnnouncement({
        available: shard.length,
        allocated: shard.length
      });
      nodes[2].publishCapacityAnnouncement({
        available: shard.length,
        allocated: shard.length
      });
    }, 2500);
  });

  it('should succeed in claiming the space', function(done) {
    this.timeout(6000);
    const renter = nodes[0];
    const farmer = capacities[0][1];
    contract = new renter.database.ShardContract({
      shardHash: orc.utils.rmd160sha256(shard).toString('hex'),
      shardSize: shard.length,
      ownerParentKey: renter.contact.xpub,
      ownerIndex: renter.contact.index,
      ownerIdentity: renter.identity.toString('hex'),
      auditLeaves: audit.getPublicRecord()
    });
    contract.sign('owner', renter.spartacus.privateKey);
    renter.claimProviderCapacity(farmer, contract.toObject(), (err, result) => {
      expect(err).to.equal(null);
      contract = new renter.database.ShardContract(result[0]);
      const t = result[1];
      const uploader = orc.utils.createShardUploader(
        farmer,
        orc.utils.rmd160sha256(shard).toString('hex'),
        t
      );
      expect(contract.validateSync()).to.equal(undefined);
      uploader.on('error', done);
      uploader.on('response', (res) => {
        let body = '';
        res.on('data', (data) => body += data.toString());
        res.on('end', () => {
          if (res.statusCode !== 200) {
            done(new Error(body));
          } else {
            done();
          }
        });
      });
      uploader.write(shard);
      uploader.end();
    });
  });

  it('should succeed in auditing the shard', function(done) {
    this.timeout(6000);
    const renter = nodes[0];
    const farmer = capacities[0][1];
    const challenge = audit.getPrivateRecord().challenges[0];
    const hash = orc.utils.rmd160sha256(shard).toString('hex');
    renter.auditRemoteShards(farmer, [
      { hash, challenge }
    ], (err, result) => {
      expect(err).to.equal(null);
      expect(result[0].proof).to.not.equal(null);
      const proof = orc.Proof.verify(
        result[0].proof,
        audit.getPrivateRecord().root,
        audit.getPrivateRecord().depth
      );
      expect(Buffer.compare(...proof)).to.equal(0);
      done();
    });
  });

  it('should succeed in mirroring the shard', function(done) {
    this.timeout(6000);
    const renter = nodes[0];
    const source = capacities[0][1];
    const destination = capacities[1][1];
    const hash = orc.utils.rmd160sha256(shard).toString('hex');
    renter.authorizeConsignment(destination, [hash], (err, result) => {
      expect(err).to.equal(null);
      const [token] = result;
      renter.createShardMirror(source, { destination, hash, token }, (err) => {
        expect(err).to.equal(null);
        done();
      });
    });
  });

  it('should succeed in retrieving the shard from mirror', function(done) {
    this.timeout(6000);
    const renter = nodes[0];
    const mirror = capacities[0][1];
    const hash = orc.utils.rmd160sha256(shard).toString('hex');
    renter.authorizeRetrieval(mirror, [hash], (err, result) => {
      expect(err).to.equal(null);
      const [token] = result;
      const downloader = orc.utils.createShardDownloader(
        mirror,
        hash,
        token
      );
      let payload = Buffer.from([]);
      downloader.on('data', (data) => payload = Buffer.concat([payload, data]));
      downloader.on('end', () => {
        expect(shard.compare(payload)).to.equal(0);
        done();
      });
    });
  });

  it('should succeed in renewing the contract', function(done) {
    this.timeout(6000);
    const renter = nodes[0];
    const farmer = capacities[0][1];
    contract.auditLeaves = [];
    contract.sign('owner', renter.spartacus.privateKey);
    const descriptor = contract.toObject();
    renter.requestContractRenewal(farmer, descriptor, (err, result) => {
      expect(err).to.equal(null);
      expect(result.auditLeaves).to.have.lengthOf(0);
      done();
    });
  });

});

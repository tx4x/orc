<p align="center" class="docstrap-hideme">
  <a href="https://orc.network"><img src="https://assets.gitlab-static.net/uploads/-/system/group/avatar/3071240/29236106.png"></a>
</p>
<p style="font-size:18px" align="center"><strong>Decentralized, Anonymous, Object Storage</strong></p>
<p align="center">
  Join the discussion in <code>#orc</code> on our <a href="https://matrix.counterpointhackers.org/_matrix/client/#/room/#orc:matrix.counterpointhackers.org">Matrix server</a>!
</p>
<div align="center">
  <a href="https://www.npmjs.com/package/@orcproject/orc">
    <img src="https://img.shields.io/npm/v/@orcproject/orc.svg?style=flat-square" alt="NPM Package">
  </a> | 
  <a href="https://hub.docker.com/r/orcproject/orc">
    <img src="https://img.shields.io/docker/pulls/orcproject/orc.svg?style=flat-square" alt="Docker Hub">
  </a> | 
  <a href="https://gitlab.com/orcproject/orc/raw/master/LICENSE">
    <img src="https://img.shields.io/badge/license-AGPLv3-blue.svg?style=flat-square" alt="AGPL-3.0 License">
  </a>
</div>


---

The [**Onion Routed Cloud**](https://orc.network). ORC is a decentralized, 
anonymous, object storage platform owned and operated by allies in defense of 
human rights and opposition to censorship. 

### Installation

#### Using NPM

```
npm install -g @orcproject/orc
orcd
```

#### Using Docker

```
docker pull orcproject/orc
mkdir ~/.config/orcd
docker run -p 9089:9089 -v ~/.config/orcd:/root/.config/orcd orcproject/orc
```

### Usage

On first run, ORC will generate a fresh configuration and setup the data 
directory. Modify the created configuration at `~/.config/orcd/config` as 
desired (see the {@tutorial config}) and send `SIGINT` to the process 
(`Ctrl+C`). Once you are satisfied with your configuration, run ORC again.

Once started, you can use use the guide for {@tutorial api} to interact with 
it! You can watch your logs with `tail -f ~/.config/orcd/orcd.log`.

ORC works on an explicit trust model. By default, ORC will only trust unknown 
nodes for discovering peers, retreiving public objects, and storing object 
metadata. If you want to store objects, you must establish trust with other
nodes. This is done explicity by all parties who trust each other. Run ORC with 
your friends, other activists, or complementary organizations.

Each node is identified by the hash of their public key. You'll see this on 
every log line under the `name` property. For example, 
`b605647afc146760fc15ef7cd59720f1ee7d82e1`. To establish trust with a friend, 
each of you must provide your identity to each other out of band (we recommend 
using [Ricochet](https://ricochet.im)). Once you've exchanged identity keys, 
add a trust policy to your configuration file.

```ini
[TrustedIdenties]
b605647afc146760fc15ef7cd59720f1ee7d82e1=*
```

For every node you wish to add to your storage grid, each must add a policy 
like the above which says "allow `b605647afc146760fc15ef7cd59720f1ee7d82e1` 
to perform any (`*`) calls". See the {@tutorial config} for more information.

> If you are a press organization or activist group and would like help 
> getting setup with ORC, please reach out to us by email at 
> `counterpoint[at]openmailbox.org` - we'd love to assist you!

### Automatic Security Updates

When running the ORC server installation with Docker, you can configure your 
node to periodically check for updates and automatically download the latest 
image and restart your node to make sure you are always running the latest 
stable release. Since you already have Docker installed, pull the 
image for [Watchtower](https://github.com/v2tec/watchtower) and run it.

```
docker pull v2tec/watchtower
docker run -d --name watchtower -v /var/run/docker.sock:/var/run/docker.sock v2tec/watchtower
```

Now, Watchtower will check for the latest stable images for running containers 
and automatically update them.

### Development 

To hack on the ORC project, clone this repository and use 
[Docker Compose](https://docs.docker.com/compose/). See {@tutorial install} 
for more detailed instructions about installing prerequisites.

```
git clone https://gitlab.com/orcproject/orc
cd orc
npm install
docker-compose up --force-recreate --build
```

This will volume mount the the appropriate directories for development, and 
then boots up a complete sandboxed ORC network, including a complete sandboxed 
Tor network and once bootstrapped, binds port `10089` to the host for full 
end-to-end testing. The development container does not persist state between 
runs. Note that stable releases are tagged and the `master` branch may contain 
unstable or bleeding-edge code.

Happy hacking!

### Resources

* [Documentation](https://orcproject.gitlab.io/orc/)
* [Specification](https://gitlab.com/orcproject/protocol/raw/master/protocol.pdf)

### License

```
ORC - Distributed Anonymous Cloud  
Copyright (C) 2017  Counterpoint Hackerspace, Ltd.  
Copyright (C) 2017  Gordon Hall  

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
```

You can run `orcd` standalone and control it from any other application over 
its TCP control interface. The control interface understands JSON-RPC 2.0 
messages terminated by a carriage return and a newline (`\r\n`).

For the purpose of this guide, we assume you have the following configuration
properties set:

```
ControlPort = 5444
ControlHostname = 127.0.0.1
```

> Using the control port, you can get a very low level control over your ORC 
> node. It is very important to keep `ControlHostname` set to a loopback 
> interface unless you have taken measures to otherwise secure access to the 
> host. See the {@tutorial security} guide for more information.

The interface accepts all methods exposed by the {@link Node} class. Parameters 
are expected to be in an array format, in order of the corresponding function 
signature and sans any callback functions. Results are written back in the same 
format. If an error occurs, the control server will send back a JSON-RPC 2.0 
error message with the same `id` as the original request. Otherwise, parameters 
passed that would be passed to the callback function are included in the 
`results` property.

When starting `orcd`, you will see a log message like this:

```
{
  "name": "b95d3b65cee77810589fe21a542a5a206ad024e5",
  "hostname": "librem",
  "pid": 19604,
  "level": 30,
  "msg": "control server bound to 127.0.0.1:5444",
  "time": "2017-10-03T18:01:36.357Z",
  "v": 0
}
```

This means that the control interface is ready to use. You can query it for the 
methods it supports using telnet.

```
$ telnet 127.0.0.1 5444
Trying 127.0.0.1...
Connected to 127.0.0.1.
Escape character is '^]'.
{"jsonrpc":"2.0","id":"1234567890","method":"getMethods","params":[]}
{"jsonrpc":"2.0","id":"1234567890","result":[["ping","iterativeStore","iterativeFindNode","iterativeFindValue","quasarPublish","quasarSubscribe","auditRemoteShards","authorizeConsignment","authorizeRetrieval","claimProviderCapacity","createShardMirror","identifyService","publishCapacityAnnouncement","reportAuditResults","requestContractRenewal","subscribeCapacityAnnouncement","getMethods","getNodeInfo","ping","iterativeStore","iterativeFindNode","iterativeFindValue","quasarPublish","quasarSubscribe","auditRemoteShards","authorizeConsignment","authorizeRetrieval","claimProviderCapacity","createShardMirror","identifyService","publishCapacityAnnouncement","reportAuditResults","requestContractRenewal","subscribeCapacityAnnouncement"]]}
```

You may also like to get information about your node's status.

```
$ telnet 127.0.0.1 5444
Trying 127.0.0.1...
Connected to 127.0.0.1.
Escape character is '^]'.
{"jsonrpc":"2.0","id":"1234567890","method":"getNodeInfo","params":[]}
{"jsonrpc":"2.0","id":"1234567890","result":[{"identity":"b95d3b65cee77810589fe21a542a5a206ad024e5","updated":"2017-10-03T18:01:49.344Z","reputation":{"timestamp":"2017-10-03T18:01:49.344Z","score":0},"capacity":{"timestamp":"2017-10-03T18:01:10.294Z","available":5316683150,"allocated":5368709120},"contact":{"hostname":"dbmsjonrk2bucr4c.onion","port":443,"xpub":"xpub6AYRYZsSnqBSj2cysHtCswKXpmVmwFTcYbihx77CbrYeKBGxwaMJDeMcD6E41nzzi282KsaGvGW7URswXntbbsGVYxwqRbmFm2niWrgR9xD","agent":"orc-8.1.1-beta6/linux","index":0,"protocol":"https:"}}]}
```

All of the other supported methods are documented in the {@link Node} class. 
The primary objective for the control interface is to provide a simple way to 
control an ORC node from any programming language that support TCP sockets.

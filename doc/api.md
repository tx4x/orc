This guide will show you how to configure your node to expose a simple REST 
API that applications can use to upload, download, delete, and list objects 
you have stored in the network as well as get status information.

> Make sure you've read over the {@tutorial config} and understand the 
> the security implications for various settings related the the local bridge.

For the purposes of brevity for this guide, we are going to assume the 
following configuration scheme and will use `curl` for the examples:

```
BridgeEnabled = 1
BridgeHostname = 127.0.0.1
BridgePort = 4445
BridgeAuthenticationEnabled = 0
```

### Status Updates

You can get detailed status updates on progress of a transfer using the event 
controller. Connect to the local bridge using a WebSocket. If you have 
authentication enabled, be sure to send the appropriate 
`Authorization: Basic <base64(user:pass)>` header when creating the request. 
You will receive messages indicating the status of transfers in the form of 
JSON-RPC notification payloads including `[reference, message, data]`, where 
the *method* can be: 

* `CONNECT_INFO`
* `LOG_RAW`
* `TRANSFER_DOWN_INFO`
* `TRANSFER_DOWN_FAIL`
* `TRANSFER_DOWN_PASS`
* `TRANSFER_UP_INFO`
* `TRANSFER_UP_PASS`
* `TRANSFER_UP_FAIL`

The `reference` parameter will be either `null` if `CONNECT_INFO` or the hash 
of the object the status message is about if `TRANSFER_*`. This can be used to 
get the progress data about a pending upload or download.

### `GET /`

Fetches general status information about the running node (or serves the web
dashboard).

```
$ curl -H "Accept: application/json" http://127.0.0.1:4445 | jq
{
  "identity": "8ea323ee883729615dcbb87a4b6b934aaadf36c1",
  "contact": {
    "hostname": "qdtyzrwositobndxrfwa5xnym6lk4vjs2qop2aapffr2bxvae2lmb6yd.onion",
    "protocol": "http:",
    "port": "80",
    "xpub": "xpub69r1RjczP47n7vkfEcCjhvKNB1zgYw7YZ9SteMgTsnMYriPRNVrNt6MMhk1tEobQ9QHRKM5ExnMkGfjJNgc7anZppJQavLvhN4zfcmzvUdJ",
    "index": 0,
    "agent": "4.0.0",
    "flags": [
      [
        "ALLOCATED",
        1000000
      ],
      [
        "AVAILABLE",
        1000000
      ]
    ]
  },
  "peers": 42,
  "capacity": {
    "allocated": 1000000,
    "available": 1000000
  }
}
```

### `GET /providers`

Fetches a JSON array of all identities and their associated profiles for which 
the node has interacted with in the past 24 hours.

```
$ curl http://127.0.0.1:4445/providers | jq
[
  {
    "identity": "87e37cf78128e77cb489deb0f5e9d71adad9fc8d",
    "updated": "2017-12-02T14:47:41.311Z",
    "reputation": {
      "timestamp": "2017-12-02T14:48:17.378Z",
      "score": 0
    },
    "capacity": {
      "available": 1073737728,
      "allocated": 1073741824
    },
    "contact": {
      "xpub": "xpub6A5t8evFXdEUrjojnKHJ8Z6ouc9Zuoj9MTW9MpvmzaLKLCF9zAtwQVu8AVDTy32BxeJWYQbw2Nc2TM1GhNzG3aYctfNZoeMNZBcxm19Emny",
      "port": 80,
      "hostname": "efoe6we3k7qifabypkwrnms2wjeqm2q5x3bqomfcpp4fliazc6h2hfid.onion",
      "agent": "4.0.0",
      "index": 0,
      "protocol": "http:"
    }
  }
]
```

### `GET /providers/{identity}`

Given a known identity key, fetch the specific profile associated.

```
$ curl http://127.0.0.1:4445/87e37cf78128e77cb489deb0f5e9d71adad9fc8d | jq
{
  "identity": "87e37cf78128e77cb489deb0f5e9d71adad9fc8d",
  "updated": "2017-12-02T14:47:41.311Z",
  "reputation": {
    "timestamp": "2017-12-02T14:48:17.378Z",
    "score": 0
  },
  "capacity": {
    "available": 1073737728,
    "allocated": 1073741824
  },
  "contact": {
    "xpub": "xpub6A5t8evFXdEUrjojnKHJ8Z6ouc9Zuoj9MTW9MpvmzaLKLCF9zAtwQVu8AVDTy32BxeJWYQbw2Nc2TM1GhNzG3aYctfNZoeMNZBcxm19Emny",
    "port": 80,
    "hostname": "efoe6we3k7qifabypkwrnms2wjeqm2q5x3bqomfcpp4fliazc6h2hfid.onion",
    "agent": "4.0.0",
    "index": 0,
    "protocol": "http:"
  }
}
```

### `GET /providers/{identity}/score`

Given a known identity key, rank their reputation score into a percentile and 
report their estimated utilization allowance.

```
$ curl http://127.0.0.1:4445/87e37cf78128e77cb489deb0f5e9d71adad9fc8d/score | jq
{
  "identity": "87e37cf78128e77cb489deb0f5e9d71adad9fc8d",
  "percentile": 0,
  "allowance": null,
  "score": 0,
  "capacity": {
    "allocated": 3221225472,
    "available": 3221213184
  }
}
```
### `GET /objects`

Retreive a JSON list of your objects stored in the network and managed by this 
node. Each item returned in the list contains metadata regarding the type, 
size, name, hash, location of shards, and more.

```
$ curl http://127.0.0.1:4445/objects | jq
[
  {
    "encoding": "7bit",
    "size": 43472,
    "ecpub": "02dc3937fd97fc26a54ad976c4cda37eb513d9a86debca18dd6f2e83717c9227d3",
    "hash": "24081ee6fd4a5395a44597e36c5314b1308a197137db45e08d6d86aa070fbe84",
    "status": "finished",
    "policies": [
      "::RETRIEVE"
    ],
    "shards": [
      {
        "size": 21744,
        "hash": "e1eede74c9512f1994b18eac6465a0b471201548",
        "service": [
          "ccfbab389c9c547badb708021c0eaad4d9ec87ed",
          {
            "agent": "orc-8.1.1-beta5/linux",
            "index": 2,
            "xpub": "xpub6BRiU17o5vnTq8sGX2DgjBoU1ozBZnBDiW4avCwoFUzcYtrHMKxs8BjdS3qt6AAv42KDE2B4D2q3Fj3cYuzuCFoDijnQKJYvoMLJV2rEGVL",
            "port": 443,
            "protocol": "https:",
            "hostname": "orcwfkilxjxo63mr.onion"
          }
        ]
      },
      {
        "size": 21744,
        "hash": "0a2f5a2a47ffe851403bfb4dc56be9b09392d182",
        "service": [
          "681069cc9dc643999be1031a8740d2a341939262",
          {
            "agent": "orc-8.1.1-beta6/linux",
            "index": 0,
            "xpub": "xpub6ARoW5DJo4xBbob8Gr3HReVU3qqJQpBRqBR2SDJkaYq5eJGL17yhGijXzkmobJe3f5nPHyZrohWR5txhCUjiXvhfCR3v2vmc7MuAYCcrTbt",
            "port": 443,
            "protocol": "https:",
            "hostname": "puiq7u4bw6lroev5.onion"
          }
        ]
      },
      {
        "size": 21744,
        "hash": "4c38ad2a132b8d683abcc73f2eddf9d2700ad5d7",
        "service": [
          "1723b631252fc5f50ba43a8cfd2f38cba0daf44c",
          {
            "agent": "orc-8.1.1-beta1/linux",
            "index": 0,
            "xpub": "xpub6AxEbAJY7bV33paGh9wbGgDh7q6T67LQKBEbo93vxez4zPF4sQQnNHK55suXWk4ViZYsjy1jwdUtuuWosUWAyEQMeqXmJKhbbuZnAcGLQRF",
            "port": 443,
            "protocol": "https:",
            "hostname": "wifniq3h3gqm2b2w.onion"
          }
        ]
      }
    ],
    "mimetype": "image/png",
    "name": "avatar.png",
    "id": "59d2627ebb28977b0e6ab841"
  }
]
```

### `GET /objects/{id}/info`

Retrieve the metadata for a specific object by it's unique ID.

```
$ curl http://127.0.0.1:4445/objects/59d2627ebb28977b0e6ab841/info | jq
{
  "encoding": "7bit",
  "size": 43472,
  "ecpub": "02dc3937fd97fc26a54ad976c4cda37eb513d9a86debca18dd6f2e83717c9227d3",
  "hash": "24081ee6fd4a5395a44597e36c5314b1308a197137db45e08d6d86aa070fbe84",
  "status": "finished",
  "policies": [
    "::RETRIEVE"
  ],
  "shards": [
    {
      "size": 21744,
      "hash": "e1eede74c9512f1994b18eac6465a0b471201548",
      "service": [
        "ccfbab389c9c547badb708021c0eaad4d9ec87ed",
        {
          "agent": "orc-8.1.1-beta5/linux",
          "index": 2,
          "xpub": "xpub6BRiU17o5vnTq8sGX2DgjBoU1ozBZnBDiW4avCwoFUzcYtrHMKxs8BjdS3qt6AAv42KDE2B4D2q3Fj3cYuzuCFoDijnQKJYvoMLJV2rEGVL",
          "port": 443,
          "protocol": "https:",
          "hostname": "orcwfkilxjxo63mr.onion"
        }
      ]
    },
    {
      "size": 21744,
      "hash": "0a2f5a2a47ffe851403bfb4dc56be9b09392d182",
      "service": [
        "681069cc9dc643999be1031a8740d2a341939262",
        {
          "agent": "orc-8.1.1-beta6/linux",
          "index": 0,
          "xpub": "xpub6ARoW5DJo4xBbob8Gr3HReVU3qqJQpBRqBR2SDJkaYq5eJGL17yhGijXzkmobJe3f5nPHyZrohWR5txhCUjiXvhfCR3v2vmc7MuAYCcrTbt",
          "port": 443,
          "protocol": "https:",
          "hostname": "puiq7u4bw6lroev5.onion"
        }
      ]
    },
    {
      "size": 21744,
      "hash": "4c38ad2a132b8d683abcc73f2eddf9d2700ad5d7",
      "service": [
        "1723b631252fc5f50ba43a8cfd2f38cba0daf44c",
        {
          "agent": "orc-8.1.1-beta1/linux",
          "index": 0,
          "xpub": "xpub6AxEbAJY7bV33paGh9wbGgDh7q6T67LQKBEbo93vxez4zPF4sQQnNHK55suXWk4ViZYsjy1jwdUtuuWosUWAyEQMeqXmJKhbbuZnAcGLQRF",
          "port": 443,
          "protocol": "https:",
          "hostname": "wifniq3h3gqm2b2w.onion"
        }
      ]
    }
  ],
  "mimetype": "image/png",
  "name": "avatar.png",
  "id": "59d2627ebb28977b0e6ab841"
}
```


### `POST /objects`

You can upload a file to the network my sending a multipart/form-upload request 
to `POST /`. This works the same as if using a `<input type="file"/>` on a web
page. You can also add `policy` fields to specify access policies as defined in 
[IMP-0010](https://github.com/orcproject/imps/blob/master/imp-0010.md).

```
$ curl -F "file=@avatar.png;type=image/png;" -F "policy=::RETRIEVE" http://127.0.0.1:4445/objects | jq
```

Once the object is completely distributed, the metadata will be returned. You 
can check on the status of an object while the request is pending by listing 
the objects using `GET /`. Statuses may be *finished*, *queued*, or *failed*.

### `PUT /objects/{id}`

In the event that an upload fails due to network issues, it will end up in a 
"queued" state, which allows for it to have a retry triggered by sending this 
request. The result of this request is identical to uploading an object and 
is functionally equivalent, except instead of first accepting the file as part 
of the request, it will use the already encrypted copy stored locally.

```
$ curl -X PUT http://127.0.0.1:4445/objects/59d2627ebb28977b0e6ab841 | jq
```


### `GET /objects/{id}`

You can download a file from the network knowing only the object's ID in the 
local bridge service. The appropriate headers for content type are sent to 
enable browsers and other applications to display the downloaded object.

```
$ curl http://127.0.0.1:4445/objects/59d2627ebb28977b0e6ab841 >> avatar.png
```

> Note that decryption is performed by the local bridge service, so it is very 
> important to configure your bridge to use authentication if exposing 
> as an onion service and SSL if exposing over the clearnet.

### `GET /objects/{id}/magnet`

If you supplied an appropriate access `policy` field on upload, you can share a 
magnet link with others to fetch the object pointer.

```
$ curl http://127.0.0.1:4445/objects/59d2627ebb28977b0e6ab841/magnet | jq
{
  "href": "magnet:?xt=urn:orc:a3cd254243fc02579384d75cba2588a6c9e850d1&xs=43472&dn=avatar.png&x.ecprv=2daade3b5a4af3641e22cb0317cadf3115bc4b800e0eceaa1a4568c53e60911b&x.pword=17300e194a57251388e98b104411b2004223fe7a"
}
```

This will return a magnet link that contains the hash of the encrypted pointer 
so it can be looked up in the DHT, the name and size of the object referenced 
for interfaces to use, the key used to encrypt the pointer, and the key used 
to encrypt the object. 

> Note that this link can be used by anyone to download the pointer, which 
> allows anyone who is included in the object's access policy to download 
> and decrypt the object itself. 

### `PUT /objects`

To fetch an object pointer shared by someone else, you can send the magnet link
and get back an object pointer with an ID you can use in the download example.

```
curl -X PUT --data "magnet:?xt=..." http://127.0.0.1:4445/objects
```

> Protip! Pipe the output of the example above through 
> `jq -r .href | xclip -selection clipboard` to copy the magnet link directly 
> to your clipboard. ;)

### `DELETE /objects/{id}`

You can destroy an object, nullifying associated contracts by sending a 
`DELETE /{id}` request.

```
$ curl -X "DELETE" http://127.0.0.1:4445/objects/59d2627ebb28977b0e6ab841
```

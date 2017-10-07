The easiest way to get up and running with using ORC from a Node.js application 
is to spawn a child process from your program and connect to it over the 
control port. This package exposes a convenience method for doing this. 

```js
const orc = require('@orcproject/orc/lib');
const { child, controller } = orc(config);

// The `config` argument can be either a string path to config file to use or 
// a JSON dictionary of config properties. See configuration documentaion.

child.stdout.pipe(process.stdout); // Pipe log out put to stdout

controller.on('ready', () => {
  controller.invoke('ping', [contact], console.log); // Ping a contact
});
```

> Note that the `invoke` method on the `controller` accepts the signature 
> `(method, [params], callback)`. See {@tutorial control} for more information 
> on the API exposed by the control interface.

Since the `@orcproject/orc` package exposes all of the internals used to 
implement `orcd`, you can use the same classes to directly implement your own 
ORC node within your project. Just import the package and construct a 
{@link Node} instance with options.

```js
const orc = require('@orcproject/orc');
const node = new orc.Node(options);

node.listen(8443);
node.join(['known_node_id', { /* contact data */ }]);
```

Consult the {@link Node} documentation for a complete reference of the API 
exposed. Further documentation on usage can be found by reviewing the 
end-to-end test suite in `test/node.e2e.js`. Note that using this package as a 
library provides a very low level interface for the ORC protocol and is not 
intended for casual integration with the ORC network.

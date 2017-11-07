Make sure you have the following prerequisites installed:

* [Tor](https://torproject.org)
* [Git](https://git-scm.org)
* [Node.js LTS + NPM (6.10.x)](https://nodejs.org)
* Python 2.7
* GCC/G++/Make

### Node.js + NPM

#### GNU+Linux & Mac OSX

```
wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.0/install.sh | bash
```

Close your shell and open an new one. Now that you can call the `nvm` program,
install Node.js (which comes with NPM):

```
nvm install --lts
```

### Build Dependencies

#### GNU+Linux

Debian / Ubuntu / Mint / Trisquel / and Friends

```
apt install git python build-essential
```

Red Hat / Fedora / CentOS

```
yum groupinstall 'Development Tools'
```

You might also find yourself lacking a C++11 compiler - 
[see this](http://hiltmon.com/blog/2015/08/09/c-plus-plus-11-on-centos-6-dot-6/).

#### Mac OSX

```
xcode-select --install
```

#### Windows

Run as administrator in PowerShell or cmd:

```
npm install -g windows-build-tools
```

### Daemon + Utilities CLI

This package exposes 3 command line programs: `orc`, `orcd`,  and `orctool`. To 
install these, use the `--global` flag.

```
npm install -g @orcproject/orc
```

On Windows, things are different - and a little weird. Instead, do the following.

```
git clone https://github.com/orproject/orc
cd orc
rm package-lock.json
npm install --ignore-scripts
npm install granax
npm remove electron-prebuilt-compile
npm install electron-prebuilt-compile
npm link
npm run start-win
```

> Note that some native dependencies do not work on Windows and will fallback
> to JavaScript implementations. This will impact performance. You should run 
> GNU+Linux. :)

### Core Library

This package exposes a module providing a complete implementation of the 
protocol. To use it in your project, from your project's root directory, 
install as a dependency.

```
npm install @orcproject/orc --save
```

Then you can require the library with:

```
const orc = require('@orcproject/orc/lib');
```

### Building Packages

To build a distributable package for your platform, clone the repository and 
follow the steps above for your platform, then run:

```
npm run make # linux/osx
npm run make-win # windows
```

On Mac OS, you'll want to remove this package before building:

```
npm remove dtrace-provider
```

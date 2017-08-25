The [**Onion Routed Cloud**](https://orc.network). ORC is a distributed 
anonymous cloud storage network owned and operated by _all of us_. Join 
the discussion in `#orc` on our [community chat](https://matrix.counterpointhackers.org/_matrix/client/#/room/#orc:matrix.counterpointhackers.org)!

[![Build Status](https://img.shields.io/travis/orcproject/orc.svg?style=flat-square)](https://travis-ci.org/orcproject/orc) | 
[![Test Coverage](https://img.shields.io/coveralls/orcproject/orc.svg?style=flat-square)](https://coveralls.io/r/orcproject/orc) | 
[![Node Package](https://img.shields.io/npm/v/@orcproject/orc.svg?style=flat-square)](https://www.npmjs.com/package/@orcproject/orc) | 
[![Docker Hub](https://img.shields.io/docker/pulls/orcproject/orc.svg?style=flat-square)](https://hub.docker.com/r/orcproject/orc) | 
[![License (AGPL-3.0)](https://img.shields.io/badge/license-AGPL3.0-blue.svg?style=flat-square)](https://raw.githubusercontent.com/orcproject/orc/master/LICENSE)

### Desktop Installation (Recommended)

Simply [download a pre-built package](https://github.com/orcproject/orc/releaes/latest) 
for your platform from the releases page!

> Note that Windows is not *yet* supported.

### Server Installation (Advanced)

Pull the [image from Docker Hub](https://hub.docker.com/r/orcproject/orc/).

```
docker pull orcproject/orc
```

Create a data directory on the host.

```
mkdir ~/.config/orc
```

Run the ORC container and mount the data directory.

```
docker run -v ~/.config/orc:/root/.config/orc -t orcproject/orc:latest
```

Modify the created configuration at `~/.config/orc/config` as desired (see 
the {@tutorial config}) and restart the container for the changes to take 
effect. Be sure to expose `BridgePort` and map it to the host.

```
docker run \
  --publish 127.0.0.1:4445:4445 \
  --volume ~/.config/orc:/root/.config/orc \
  --tty orcproject/orc:latest
```

> See the [`docker run` documentation](https://docs.docker.com/engine/reference/commandline/run/) 
> for more information. If you prefer to install ORC manually, see the guide for 
> {@tutorial install}. Once installed, simply run `orc` with an optional 
> configuration file using the `--config <path/to/config>` option.

Once the container has started, you can navigate in your browser to 
`http://127.0.0.1:4445` to access your node's dashboard! **If you did not 
disable `BridgeAuthenticationEnabled`, you will be asked for supply the 
credentials in your configuration file.**

### Development 

To hack on the ORC project, clone this repository and use 
[Docker Compose](https://docs.docker.com/compose/):

```
git clone https://github.com/orcproject/orc
cd orc
docker-compose up
```

This will volume mount the the appropriate directories for development, and 
then boots up the ORC container. **Note that stable releases are tagged and 
the `master` branch may contain unstable or bleeding-edge code.**

> Alternatively, you can run directly on your host. Use `npm install` and 
> `npm start` to install dependencies and start the application.

Happy hacking!

### Resources

* [Documentation](https://orcproject.github.io/orc/)
* [Specification](https://raw.githubusercontent.com/orcproject/protocol/master/protocol.pdf)

### License

ORC - Distributed Anonymous Cloud  
Copyright (C) 2017  Counterpoint Hackerspace, Ltd.  

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see
[http://www.gnu.org/licenses/](http://www.gnu.org/licenses/).

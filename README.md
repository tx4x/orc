The [**Onion Routed Cloud**](https://orc.network). ORC is a distributed 
anonymous cloud storage network owned and operated by _all of us_. Join 
the discussion in `#orc` on our [community chat](https://matrix.counterpointhackers.org/_matrix/client/#/room/#orc:matrix.counterpointhackers.org)!

[![Build Status](https://img.shields.io/travis/orcproject/orc.svg?style=flat-square)](https://travis-ci.org/orcproject/orc) | 
[![Test Coverage](https://img.shields.io/coveralls/orcproject/orc.svg?style=flat-square)](https://coveralls.io/r/orcproject/orc) | 
[![Node Package](https://img.shields.io/npm/v/@orcproject/orc.svg?style=flat-square)](https://www.npmjs.com/package/@orcproject/orc) | 
[![Docker Hub](https://img.shields.io/docker/pulls/orcproject/orc.svg?style=flat-square)](https://hub.docker.com/r/orcproject/orc) | 
[![License (AGPL-3.0)](https://img.shields.io/badge/license-AGPL3.0-blue.svg?style=flat-square)](https://raw.githubusercontent.com/orcproject/orc/master/LICENSE)

> **Warning!** ORC is *alpha* software and is still a highly experimental 
> *test* network! Be smart, keep backups, and stay safe out there! 

### Installation

Pull the [image from Docker Hub](https://hub.docker.com/r/orcproject/orc/).

```
docker pull orcproject/orc
```

Create a data directory on the host.

```
mkdir ~/.config/orcd
```

If you are running ORC for the first time, mount the data directory and run it 
normally.

```
docker run --volume ~/.config/orcd:/root/.config/orcd orcproject/orc
```

This will generate a fresh configuration and setup the data directory. Modify 
the created configuration at `~/.config/orcd/config` as desired (see the 
{@tutorial config}) and send `SIGINT` to the process (`Ctrl+C`). If you want to 
provide storage capacity to the network, be sure to set your desired allocation 
for `ShardStorageMaxAllocation`.

Once you are finished, run the ORC container again, but expose the API to the 
host, mount the data directory, allocate a pseudo TTY, detach the process, and 
tell docker to keep it running (even starting automatically on system boot).

```
docker run \
  --publish 127.0.0.1:9089:9089 \
  --volume ~/.config/orcd:/root/.config/orcd \
  --restart always \
  --tty --detach orcproject/orc
```

Once the container has started, you can use use the guide for {@tutorial api} 
to interact with it! You can watch your logs with 
`tail -f ~/.config/orcd/orcd.log`.

See the [`docker run` documentation](https://docs.docker.com/engine/reference/commandline/run/) 
for more information. If you prefer to install ORC manually, see the guide for 
{@tutorial install}. Once installed, simply run `orcd` with an optional 
configuration file using the `--config <path/to/config>` option.

#### Automatic Security Updates

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
[Docker Compose](https://docs.docker.com/compose/):

```
git clone https://github.com/orcproject/orc
cd orc
docker-compose up --force-recreate --build
```

This will volume mount the the appropriate directories for development, and 
then boots up a complete sandboxed ORC network, including a complete sandboxed 
Tor network and once bootstrapped, binds port `9089` to the host for full 
end-to-end testing. The development container does not persist state between 
runs. Note that stable releases are tagged and the `master` branch may contain 
unstable or bleeding-edge code.

Happy hacking!

### Resources

* [Documentation](https://orcproject.github.io/orc/)
* [Specification](https://raw.githubusercontent.com/orcproject/protocol/master/protocol.pdf)

### License

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
along with this program.  If not, see
[http://www.gnu.org/licenses/](http://www.gnu.org/licenses/).

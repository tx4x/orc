#!/usr/bin/env bash

if [[ $TRAVIS_OS_NAME = 'osx' ]]; then
    brew update
    brew install mongodb
    sudo mkdir -p /data/db
    brew services start mongodb
fi


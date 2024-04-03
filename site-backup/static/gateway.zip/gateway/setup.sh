#!/bin/bash
sudo apt-get update
sudo apt-get install -y python3-pip libdb-dev
sudo pip3 install cryptography bsddb3
cd "$(dirname "${BASH_SOURCE[0]}")"
sudo python3 -c "from bsddb3 import hashopen; db = hashopen('data.db'); db[b'business'] = '$1'.encode('ascii'); db[b'secret'] = '$2'.encode('ascii'); db.close()"

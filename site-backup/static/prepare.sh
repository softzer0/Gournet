#!/bin/bash
set -e
wget -nc https://gournet.co/static/db-4.8.30.NC.compiled.raspberry.tar.gz
tar -xzf db-*.compiled.raspberry.tar.gz --one-top-level
rm db-*.compiled.raspberry.tar.gz
wget -nc https://gournet.co/static/gateway.zip
unzip -o gateway.zip
rm gateway.zip
chmod +x install.sh
echo 'pi:testpassword' | sudo chpasswd
sudo mkdir /var/run/sshd
sudo chmod 755 -R /var/run/sshd
sudo service ssh restart

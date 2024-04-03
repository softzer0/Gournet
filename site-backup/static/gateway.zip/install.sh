#!/bin/bash
if [ -z "$1" ] || [ -z "$2" ]
then
 echo "./install.sh business-shortname '\$EcR3tW16Chars!1'"
 exit
fi
cd db-*.compiled.raspberry/build
sudo make install_include install_lib install_utilities
mv ../../gateway ~
sudo tee /lib/systemd/system/gournet-gateway.service >/dev/null <<EOF
[Unit]
Description=Gournet gateway
After=multi-user.target

[Service]
Type=simple
WorkingDirectory=$(eval echo ~$USER)/gateway
ExecStart=/usr/bin/python3 $(eval echo ~$USER)/gateway/server.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo chmod 644 /lib/systemd/system/gournet-gateway.service
sudo systemctl daemon-reload
chmod +x ~/gateway/setup.sh
~/gateway/setup.sh $1 $2
sudo mkdir /etc/systemd/journald.conf.d
sudo tee /etc/systemd/journald.conf.d/00-journal-size.conf >/dev/null <<'EOF'
[Journal]
SystemMaxUse=30M
RuntimeMaxUse=30M
EOF
sudo systemctl restart systemd-journald
ip=$(ip -o route get to 8.8.8.8 | sed -n 's/.*src \([0-9.]\+\).*/\1/p')
sudo cat >>/etc/dhcpcd.conf <<EOL
interface eth0
inform $ip
EOL
sudo systemctl enable gournet-gateway
sudo systemctl start gournet-gateway
echo https://gournet.co/$1/?gen_qr=$ip
sudo systemctl stop ssh
sudo systemctl disable ssh

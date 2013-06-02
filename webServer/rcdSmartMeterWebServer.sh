#!/bin/sh -e
### BEGIN INIT INFO
# Provides:          smartMeterWebServer
# Required-Start:    networking
# Default-Start:     2 3 4 5
# Default-Stop:      0 6
# Required-Stop:     $remote_fs $syslog
### END INIT INFO


WPATH=/home/pi/production/smartMeter/
RCPATH=/home/pi/production/smartMeter/webServer/
SERVER=webServer/djserver_eenergy.js
SERVERPARAMS="serverport=42080"
SERVERPATH=$WPATH$SERVER
RCDSERVER=rcdSmartMeterWebServer.sh

case "$1" in
'start')
mypids=$(ps -ef | grep $SERVER | grep -v "grep" | wc -l)
if [ $mypids -gt 0 ] 
then
	echo there is $mypids $SERVER running 
	echo `ps -ef | grep $SERVER | grep -v grep`
else
	(cd $WPATH; $SERVER $SERVERPARAMS ) > /tmp/djserver_eenergy.log 2>&1 &
	echo started $SERVER $SERVERPARAMS
fi
;;
 
'stop')
echo "Stoping smartMeterWebServer ..."
for ps in `ps -ef | grep $SERVER | grep -v grep | awk '{print $2}'`
do
	echo 'found $SERVER in process '$ps'. Now kill it...'
	kill -9 $ps
	echo done
done
;;
 
'restart')
$0 stop
$0 start
;;

'rcinstall')
    echo "installing $WPATH$RCDSERVER in /etc/init.d/."
	sudo cp $RCPATH$RCDSERVER /etc/init.d/.
	sudo update-rc.d -f $RCDSERVER start 99 2 3 4 5 .
;;

'Required-Stop')
;;
esac
 
exit 0
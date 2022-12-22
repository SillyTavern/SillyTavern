#!/bin/sh
#set -x
# find existing web inspector


killprocess(){
	
	echo ps -ef | awk "!/awk/ && /$1/ {print $2}"
	#pid=`ps -ef | awk -v keyword=$1 "!/awk/ && /${keyword}/ {print $2}"`;
	pid=`ps -ef | awk -v a=node-inspector '!/awk/ && /${a}/ {print $2}'`;
	echo current $1 process is $pid;

	if [ -n '$pid' ]
	then
		echo killing $1 process $pid;	
		#kill $pid;
		
	else
		echo $1 is not active;
		
	fi
}




killprocess node-inspector
killprocess mocha

echo launching node-inspector
node-inspector &

echo launching test $1
mocha --debug-brk  -R spec $1 &



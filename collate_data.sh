#!/bin/bash

if [ "$1" = '-h' ] || [ -z "$1" ]; then
   echo "Usage: $0 http://somewebsite.com <start_timestamp> <end_timestamp>"
   echo "For timestamps use the middle 5 digits (ex. for 1590350400000 use 35040)"
else
   if [[ ${1:0:4} == "http" ]] ; then
      site=$1
   else
      site="http://${1}"
   fi
   for i in `seq $2 360 $3`;
   do
      echo "${site}/collate/1590${i}0000"
      curl -s "${site}/collate/1590${i}0000"
      sleep 60
   done
   echo "Done!"
fi

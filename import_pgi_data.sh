#!/bin/bash

if [ "$1" = '-h' ] || [ -z "$1" ]; then
   echo "Usage: $0 http://somewebsite.com <start_offset_hours> <number_hours_to_process>"
else
   if [[ ${1:0:4} == "http" ]] ; then
      site=$1
   else
      site="http://${1}"
   fi
   for i in $(seq $2 $3);
   do
      curl -s "${site}/pgi/${i}"
      sleep 150
   done
   echo "Done!"
fi

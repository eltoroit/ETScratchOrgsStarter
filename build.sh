#!/bin/zsh
echo "sf project deploy start --ignore-conflicts --verbose --json"
sf project deploy start --ignore-conflicts --verbose --json 
if [ $? -eq 0 ] 
then 
    print "\u001b[42m\u001b[1;30m*** *** SUCCESS *** ***\u001b[0m"
else 
    print "\u001b[43m\u001b[1;31m*** *** FAILED *** ***\u001b[0m"
fi
date
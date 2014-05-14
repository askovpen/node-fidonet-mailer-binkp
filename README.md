node-fidonet-mailer-binkp
=========================

[![Build Status](https://travis-ci.org/askovpen/node-fidonet-mailer-binkp.svg?branch=master)](https://travis-ci.org/askovpen/node-fidonet-mailer-binkp)

[![(npm package version)](https://nodei.co/npm/fidonet-mailer-binkp.png?downloads=true)](https://npmjs.org/package/fidonet-mailer-binkp)

this is alpha.

## Usage

```js
var BinkPc=require('./');
var path=require('path');
var myinfo={
    'sysop':'Sysop Name',
    'sysname':'new BBS',
    'location':'Russia',
    'nodeinfo':'NDL',
    'address':['2:5020/9696.777','10:10/10.10']
};
var remoteinfo={'2:5020/9696.0': {
    'address':'2:5020/9696.0',
    'password':'supersecretpasswordhuyugadaesh',
    'host':'127.0.0.1'
}};
var files={'2:5020/9696.0': [
    {
        'filename':path.join(__dirname,'/out/test.txt'),
        'size':6,
        'kknd':'^',
        'prio':'c',
        'bundle':null
    },
    {
        'filename':path.join(__dirname,'/out/test2.bin'),
        'size':51200,
        'kknd':'^',
        'prio':'c',
        'bundle':null
    }
]};
var inbound=path.join(__dirname,'/in');

        var options=null;
        var client=BinkPc(myinfo,remoteinfo,files,inbound,0);
        client.on('auth',function(data){
            console.log(data);
        });
        client.start(function(err){
        	console.log('end');
        });

        var server=BinkPc(myinfo,remoteinfo,files,inbound,1);
        server.on('auth',function(data){console.log(data);}
		server.server(24554,function(err){console.log(err);});
```

node-fidonet-mailer-binkp
=========================

node-fidonet-mailer-binkp

this is alpha.
now only client.

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
var remoteinfo={
    'address':'2:5020/9696.0',
    'password':'supersecretpasswordhuyugadaesh',
    'host':'127.0.0.1'
};
var files=[
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
];
var inbound=path.join(__dirname,'/in');

        var options=null;
        var client=BinkPc(myinfo,remoteinfo,files,inbound,options);
        client.on('auth',function(data){
            console.log(data);
        });
        client.start(function(err){
        	console.log('end');
        });
```
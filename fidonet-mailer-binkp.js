var net=require('net');
var fs=require('fs');
var crypto=require('crypto');
var util=require('util');
var path=require('path');
var BinkPc=function(myinfo,remoteinfo,files,inbound,options){
	if (!(this instanceof BinkPc)) return new BinkPc(myinfo,remoteinfo,files,inbound,options);
	this.myinfo=myinfo;
	this.remoteinfo=remoteinfo;
	this.rgain={};
	this.rgain.addr=[];
	this.files=files;
	this.inbound=inbound;
	this.options=options;
	this.client=null;
	this.rcvBuf=null;
	this.progress=0;
	this.chunk=0;
	this.sprogress=0;
	this.stage=0;
	this.file=null;
	this.fileFD=null;
	this.sfileFD=null;
	process.EventEmitter.call(this);
};
util.inherits(BinkPc, process.EventEmitter);
BinkPc.prototype.start=function(callback){
	self=this;
	this.client = net.connect({host:this.remoteinfo.host,port: 24554},function(){console.log('connected');});
	this.client.on('data',function(data){
		self.onRead(self,data,callback);
	});
	this.client.on('end',function(){
		console.log('disconnected');
		callback();
	});
	this.client.on('error',function(err){
		console.log(err);
		callback();
	});
};
BinkPc.prototype.Address_equal=function(addr1,addr2){
	var re=new RegExp('(\\d+):(\\d+)/(\\d+)\\.?(\\d+)?(@.*)?');
	var p1=addr1.match(re);
	var p2=addr2.match(re);
	if (p1[1]==p2[1]&&p1[2]==p2[2]&&p1[3]==p2[3]){
		if (p1[4]==p2[4]){return true;}
		if (p1[4]===undefined && p2[4]=='0'){return true;}
		if (p2[4]===undefined && p1[4]=='0'){return true;}
	}
	return false;
};
BinkPc.prototype.send=function(self,callback){
	while(self.sprogress<self.files[0].size){
		var buf;
		var rbuf;
		if (self.files[0].size-self.sprogress>4096){
			buf=new Buffer(4098);
			buf.writeUInt16BE(4096,0);
			fs.readSync(self.sfileFD,buf,2,4096,self.sprogress);
			self.client.write(buf);
			self.sprogress+=4096;
		} else {
			buf=new Buffer(self.files[0].size-self.sprogress+2);
			buf.writeUInt16BE(self.files[0].size-self.sprogress,0);
			fs.readSync(self.sfileFD,buf,2,self.files[0].size-self.sprogress,self.sprogress);
			console.log(self.files[0].filename+' sended');
			self.client.write(buf);
			fs.closeSync(self.sfileFD);
			self.sprogress=self.files[0].size;
			self.files.splice(0,1);
			return;
		}
	}
};
BinkPc.prototype.sendFile=function(self,data,callback){
	if (self.files.length>0){
		var tstr2=path.basename(self.files[0].filename)+' '+self.files[0].size+' 1399839506 -1';
		buf=new Buffer(tstr2.length+3);
		buf[0]=128;
		buf[1]=tstr2.length+1;
		buf[2]=3;
		new Buffer(tstr2).copy(buf,3);
		self.client.write(buf);
	}else {
//		self.client.write(new Buffer([128,1,5]));
	}
};
BinkPc.prototype.onRead=function(self,data,callback){
		var i=0;
		if (self.rcvBuf!==null){
			data=Buffer.concat([self.rcvBuf,data]);
			self.rcvBuf=null;
		}
		while (i<data.length){
			var len;
			if (data[i]==128){
				i++;
				len=data[i];
				i++;
				var type=data[i];
				i++;
//				console.log('type: '+type+' len: '+len+' buf.len '+data.slice(i,i+len-1).length );
				if (data.slice(i,i+len-1).length<len-1){
					self.rcvBuf=data.slice(i-3,i+len-1);
				}
				if (type===0) {
					var str=data.toString(null,i,i+len-1);
					self.rgain[str.substr(0,str.indexOf(' '))]=str.substr(str.indexOf(' ')+1,len-str.indexOf(' '));
					if (str.substr(0,str.indexOf(' '))=='TRF'){self.emit('auth',self.rgain);
						self.sendFile(self);
					}
				} else if (type==1) {
					self.rgain.addr=self.rgain.addr.concat(data.toString(null,i,i+len-1).split(' '));
//						console.log(data.toString(null,i,i+len-1).split(' '));
				} else if (type==4) {
					console.log(data.toString(null,i,i+len-1));
					if (data.toString(null,i,i+len-1)!='secure') {
//							callback('password wrong');
					}
				} else if (type==3) {
					self.file=data.toString(null,i,i+len-1).split(' ');
//						console.log(self.file);
					if (self.file[3]=='-1') {
						self.fileFD=fs.openSync(self.inbound+'/'+self.file[0],'w');
						var answer=new Buffer(data.toString(null,i,i+len-1)+2);
						answer[0]=128;
						answer[1]=data.toString(null,i,i+len-1).length-1;
						answer[2]=9;
						self.progress=self.file[1];
						new Buffer(self.file[0]+' '+self.file[1]+' '+self.file[2]+' 0').copy(answer,3);
//							console.log(answer);
						self.client.write(answer);
					}else if (self.file[3]=='0') {
						self.stage=2;
					}
				} else if (type==5) {
					if (self.files.length>0) {
						self.sendFile(self);
					} else {
						self.client.write(new Buffer([128,1,5]));
					}
				} else if (type==6) {
					console.log(data.toString(null,i,i+len-1));
					if (self.files.length>0){
						if (path.basename(self.files[0].filename)==data.toString(null,i,i+len-1).split(' ')[0]){
//									fs.closeSync(self.sfileFD);
							console.log(self.files[0].filename+' skipped');
							self.files.splice(0,1);
							self.sendFile(self);
						}
					}else {
//						self.client.write(new Buffer([128,1,5]));
					}
				} else if (type==8) {
					callback(data.toString(null,i,i+len-1));
				} else if (type==9) {
					var sfile=data.toString(null,i,i+len-1).split(' ');
					if (sfile[3]=='0'){
						self.sfileFD=fs.openSync(self.files[0].filename,'r');
						var answer3=new Buffer(len+2);
						answer3[0]=128;
						answer3[1]=data.toString(null,i,i+len-1).length+1;
						answer3[2]=3;
						new Buffer(sfile[0]+' '+sfile[1]+' '+sfile[2]+' 1').copy(answer3,3);
						self.client.write(answer3);
//						console.log(answer3);
//							console.log(answer3.toString());
//							console.log(sfile[0]+' '+sfile[1]+' '+sfile[2]+' 1');
							self.send(self);
					}
				} else {
//						console.log(data.toString(null,i,i+len-1));
				}
				i=i+len-1;
			} else {
//					console.log('fail');
//					callback();
//				}
//				i=i+len-1;
//			}else if (self.stage==2){
//				console.log(data);
			var str2;
			var answer2;
			if (data.length-2==self.file[1]) {
				fs.writeSync(self.fileFD,data,2,data.length-2);
				fs.closeSync(self.fileFD);
				console.log(self.file[0]+' file received');
				str2=self.file[0]+' '+self.file[1]+' '+self.file[2];
				answer2=new Buffer(str2.length+3);
				answer2[0]=128;
				answer2[1]=str2.length+1;
				answer2[2]=6;
				new Buffer(str2).copy(answer2,3);
//					console.log(answer2);
				self.client.write(answer2);
				self.stage=1;
				i=data.length;
			} else {
				var clength;
				if (self.chunk===0){
					self.chunk=data.readUInt16BE(i);
					if (self.chink===0){callback('3');}
					i+=2;
					if (data.slice(i,i+self.chunk).length==self.chunk) {
						fs.writeSync(self.fileFD,data,i,self.chunk);
						self.progress-=self.chunk;
						i=i+self.chunk;
						self.chunk=0;
					}else {
						fs.writeSync(self.fileFD,data,i,data.slice(i,i+self.chunk).length);
						self.progress-=data.slice(i,i+self.chunk).length;
						self.chunk-=data.slice(i,i+self.chunk).length;
						i=data.length;
					}
				}else {
					fs.writeSync(self.fileFD,data,i,self.chunk);
					self.progress-=self.chunk;
					i+=self.chunk;
					self.chunk=0;
				}
				if (self.progress===0){
					fs.closeSync(self.fileFD);
//						console.log(self.file[0]+' file write');
					str2=self.file[0]+' '+self.file[1]+' '+self.file[2];
					answer2=new Buffer(str2.length+3);
					answer2[0]=128;
					answer2[1]=str2.length+1;
					answer2[2]=6;
					new Buffer(str2).copy(answer2,3);
					self.client.write(answer2);
					self.stage=1;
				}
			}
		}
	}
	if (self.stage===0){
		if (('OPT' in self.rgain) && (self.rgain.addr.length>0)){
			self.makeAnswer(self,callback);
		}
	}
};
BinkPc.prototype.hashPWD=function(self,callback){
	var answer=new Buffer([128,42,2]);
	if (self.rgain.OPT.substr(0,8)!='CRAM-MD5'){
		callback('unknown challenge '+self.rgain.OPT);
	}
	var chal=new Buffer(self.rgain.OPT.substr(9),'hex');
	var hmac=crypto.createHmac('md5',self.remoteinfo.password);
	hmac.update(chal);
//	console.log(hmac.digest('hex'));
	//	console.log(chal);
	return Buffer.concat([answer,new Buffer(('CRAM-MD5-'+hmac.digest('hex')))]);
};
BinkPc.prototype.makePkt=function(self,name,data,callback){
	var buf=new Buffer(data.length+name.length+4);
	buf[0]=128;//SYS
	buf[1]=data.length+name.length+2;
	buf[2]=0;
	new Buffer(name).copy(buf,3);
	buf[name.length+3]=32;
	new Buffer(data).copy(buf,name.length+4);
	return buf;
};
BinkPc.prototype.makeAnswer=function(self,callback){
	var found=false;
	self.rgain.addr.forEach(function(addr){
		if (self.Address_equal(self.remoteinfo.address,addr)){found=true;}
	});
	if (!found){
		self.client.destroy();
		callback('not needed address on remote');
	}
	var buf=new Buffer(0);
	buf=Buffer.concat([buf,self.makePkt(self,'SYS',self.myinfo.sysname)]);
	buf=Buffer.concat([buf,self.makePkt(self,'ZYZ',self.myinfo.sysop)]);
	buf=Buffer.concat([buf,self.makePkt(self,'LOC',self.myinfo.location)]);
	buf=Buffer.concat([buf,self.makePkt(self,'NDL',self.myinfo.nodeinfo)]);
	buf=Buffer.concat([buf,self.makePkt(self,'VER','nbinkp/0.0.1 binkp/1.1')]);
	buf=Buffer.concat([buf,self.makePkt(self,'OPT','NDA NR BM')]);
	var trf=0;
	self.files.forEach(function(file){
		trf+=file.size;
	});
	buf=Buffer.concat([buf,self.makePkt(self,'TRF','0 '+trf)]);
//	console.log(self.myinfo.address.join(' '));
	addb=new Buffer(self.myinfo.address.join(' ').length+3);
	addb[0]=128;addb[1]=self.myinfo.address.join(' ').length+1;addb[2]=1;
	new Buffer(self.myinfo.address.join(' ')).copy(addb,3);
	buf=Buffer.concat([buf,addb]);
	buf=Buffer.concat([buf,self.hashPWD(self,callback)]);
//	console.log(self.hashPWD(self,callback));
//	console.log(buf);
	self.client.write(buf);
	self.stage=1;
};
module.exports=BinkPc;

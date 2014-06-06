/* jshint unused: true */
var net=require('net');
var fs=require('fs');
var crypto=require('crypto');
var crypt=require('fidonet-mailer-binkp-crypt');
var util=require('util');
var path=require('path');
var BinkPc=function(myinfo,remoteinfo,files,inbound,mode){
	if (!(this instanceof BinkPc)) return new BinkPc(myinfo,remoteinfo,files,inbound,mode);
	this.myinfo=myinfo;
	this.files=files;
	this.connection={};
	this.inbound=inbound;
	this.mode=mode;
	this.remoteinfo=remoteinfo;
	this.stage=0;
	process.EventEmitter.call(this);
};
util.inherits(BinkPc, process.EventEmitter);
BinkPc.prototype.server=function(port,callback){
	var self=this;
	var srv = net.createServer(function(socket) {
		console.log('connected '+socket.remoteAddress+':'+socket.remotePort);
		self.connection[socket]={};
		self.connection[socket].rgain={};
		self.connection[socket].rgain.addr=[];
		self.connection[socket].remote_done=false;
		self.connection[socket].progress=0;
		self.connection[socket].chunk=0;
		self.connection[socket].crypt=false;
		self.connection[socket].sprogress=0;
		self.connection[socket].challenge=crypto.pseudoRandomBytes(10).toString('hex');
		self.makeAnswer(self,callback,socket);
		socket.on('data',function(data){
			self.onRead(self,data,callback,socket);
		});
		 socket.on('end', function () {
			console.log('disconnected');
			delete(self.connection[socket]);
//		 clients.splice(clients.indexOf(socket), 1);
//		 broadcast(socket.name + " left the chat.\n");
		 });
	});
	srv.listen(port);
};
BinkPc.prototype.start=function(callback){
	self=this;
	var client = net.connect({host:this.remoteinfo.host,port: 24554},function(){console.log('connected');});
	self.connection[client]={};
	self.connection[client].remote_done=false;
	self.connection[client].progress=0;
	self.connection[client].sprogress=0;
	self.connection[client].chunk=0;
	self.connection[client].rgain={};
	self.connection[client].crypt=false;
	self.connection[client].rgain.addr=[];
	client.on('data',function(data){
		self.onRead(self,data,callback,client);
	});
	client.on('end',function(){
		console.log('disconnected');
		delete(self.connection[client]);
		callback();
	});
	client.on('error',function(err){
		delete(self.connection[client]);
		console.log(err);
		callback();
	});
};
BinkPc.prototype.nAddress=function(addr1){
	var re=new RegExp('(\\d+):(\\d+)/(\\d+)\\.?(\\d+)?(@.*)?');
	var p1=addr1.match(re);
	if (p1[4]===undefined){p1[4]=0;}
	return p1[1]+':'+p1[2]+'/'+p1[3]+'.'+p1[4];
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
BinkPc.prototype.send=function(self,socket){
	console.log('send');
	while(self.connection[socket].sprogress<self.files[self.connection[socket].remote_addr][0].size){
//		console.log(self.connection[socket].sprogress);
		var buf;
		if (self.files[self.connection[socket].remote_addr][0].size-self.connection[socket].sprogress>4096){
			buf=new Buffer(4098);
			buf.writeUInt16BE(4096,0);
			fs.readSync(self.connection[socket].sfileFD,buf,2,4096,self.connection[socket].sprogress);
			self.send(self,socket,buf);
			self.connection[socket].sprogress+=4096;
		} else {
			buf=new Buffer(self.files[self.connection[socket].remote_addr][0].size-self.connection[socket].sprogress+2);
			buf.writeUInt16BE(self.files[self.connection[socket].remote_addr][0].size-self.connection[socket].sprogress,0);
			fs.readSync(self.connection[socket].sfileFD,buf,2,self.files[self.connection[socket].remote_addr][0].size-self.connection[socket].sprogress,self.connection[socket].sprogress);
			console.log(self.files[self.connection[socket].remote_addr][0].filename+' sended');
			self.send(self,socket,buf);
//			console.log(buf);
//			console.log(buf.length);
			fs.closeSync(self.connection[socket].sfileFD);
			self.connection[socket].sprogress=self.files[self.connection[socket].remote_addr][0].size;
			self.files[self.connection[socket].remote_addr].splice(0,1);
			if (self.files[self.connection[socket].remote_addr].length===0){
				if (self.connection[socket].remote_done){
					self.send(self,socket,new Buffer([128,1,5]));
				}
			}
			return;
		}
	}
};
BinkPc.prototype.sendFile=function(self,socket){
//	console.log(self.files[self.connection[socket].remote_addr]);
	if (self.files[self.connection[socket].remote_addr].length>0) {
		if (!fs.existsSync(self.files[self.connection[socket].remote_addr][0].filename)) {
			console.log(self.files[self.connection[socket].remote_addr][0].filename+' not found');
			self.files[self.connection[socket].remote_addr].splice(0,1);
			self.sendFile(self,socket);
		}
	}
	if (self.files[self.connection[socket].remote_addr].length>0){
		console.log('want send');
//		self.connection[socket].sprogress=0;
		var tstr2=path.basename(self.files[self.connection[socket].remote_addr][0].filename)+' '+self.files[self.connection[socket].remote_addr][0].size+' 1399839506 -1';
		buf=new Buffer(tstr2.length+3);
		buf[0]=128;
		buf[1]=tstr2.length+1;
		buf[2]=3;
		new Buffer(tstr2).copy(buf,3);
//		console.log('s3 '+buf.slice(3).toString());
		self.send(self,socket,buf);
	}else {
//		self.client.write(new Buffer([128,1,5]));
	}
};
BinkPc.prototype.onRead=function(self,data,callback,socket){
		if (self.connection[socket].crypt){
//			console.log(data);
//			self.connection[socket].keyin.init_keys();
			self.connection[socket].decrypted=true;
			data=self.connection[socket].keyin.decrypt_buf(data);
		}
		var i=0;
		if (self.connection[socket].rcvBuf!==undefined){
//			console.log('buf');
//		console.log(self.connection[socket].rcvBuf);
			data=Buffer.concat([self.connection[socket].rcvBuf,data]);
			self.connection[socket].rcvBuf=undefined;
		}
		while (i<data.length){
			if (self.connection[socket].crypt && !self.connection[socket].decrypted){
				console.log('!!!');
//				self.connection[socket].keyin.init_keys();
				data=self.connection[socket].keyin.decrypt_buf(data.slice(i));
//				console.log(data);
				i=0;
			}
			var len;
			if (data[i]==128){
				i++;
				len=data[i];
				i++;
				var type=data[i];
				i++;
//				console.log('type: '+type+' len: '+len+' buf.len '+data.slice(i,i+len-1).length );
				if (data.slice(i,i+len-1).length<len-1){
					self.connection[socket].rcvBuf=data.slice(i-3,i+len-1);
				}
				if (type===0) { //info
					var str=data.toString(null,i,i+len-1);
					self.connection[socket].rgain[str.substr(0,str.indexOf(' '))]=str.substr(str.indexOf(' ')+1,len-str.indexOf(' '));
					if (str.substr(0,str.indexOf(' '))=='TRF'){
					}
				} else if (type==1) { //addrs
					self.connection[socket].rgain.addr=self.connection[socket].rgain.addr.concat(data.toString(null,i,i+len-1).split(' '));
//						console.log(data.toString(null,i,i+len-1).split(' '));
				} else if (type==2) { //md5 answer
//					console.log(data.toString(null,i,i+len-1));
					if (self.mode) {
						if (data.toString(null,i,i+len-1).substr(0,9)=='CRAM-MD5-'){
//							console.log(self.rgain);
							self.checkPasswd(self,data.toString(null,i,i+len-1).substr(9),socket);
						}
					}
				} else if (type==4) { //secure answer
//					console.log(data.toString(null,i,i+len-1));
					if (!self.mode){
						if (self.connection[socket].rgain.OPT.search(/CRYPT/)){
							self.connection[socket].crypt=true;
						}
						if (!self.mode){
							self.sendFile(self,socket);
							self.emit('auth',self.connection[socket].rgain);
						}
					}
					if (data.toString(null,i,i+len-1)!='secure') {
//							callback('password wrong');
					}
				} else if (type==3) { //file set
					self.connection[socket].file=data.toString(null,i,i+len-1).split(' ');
//						console.log('3 '+data.toString(null,i,i+len-1));
					if (self.connection[socket].file[3]=='-1') {
						self.connection[socket].fileFD=fs.openSync(self.inbound+'/'+self.connection[socket].file[0],'w');
						var answer=new Buffer(data.toString(null,i,i+len-1).length+2);
						answer[0]=128;
						answer[1]=data.toString(null,i,i+len-1).length;
						answer[2]=9;
						self.connection[socket].progress=self.connection[socket].file[1];
						new Buffer(self.connection[socket].file[0]+' '+self.connection[socket].file[1]+' '+self.connection[socket].file[2]+' 0').copy(answer,3);
//							console.log('s9 '+answer.slice(3).toString());
						self.send(self,socket,answer);
					}else if (self.connection[socket].file[3]=='0') {
						self.stage=2;
					}
				} else if (type==5) {
					console.log('remote done');
					self.connection[socket].remote_done=true;
					if (self.files[self.connection[socket].remote_addr].length>0) {
						self.sendFile(self,socket);
					} else {
						self.send(self,socket,new Buffer([128,1,5]));
					}
				} else if (type==6) {
//					console.log('6 '+data.toString(null,i,i+len-1));
					if (self.files[self.connection[socket].remote_addr].length>0){
						if (path.basename(self.files[self.connection[socket].remote_addr][0].filename)==data.toString(null,i,i+len-1).split(' ')[0]){
//									fs.closeSync(self.sfileFD);
							console.log(self.files[self.connection[socket].remote_addr][0].filename+' sended');
							if (self.files[self.connection[socket].remote_addr][0].kknd=='^' ||
								self.files[self.connection[socket].remote_addr][0].kknd==' '
								){
								fs.unlinkSync(self.files[self.connection[socket].remote_addr][0].filename);
							}
							if (self.files[self.connection[socket].remote_addr][0].kknd=='#') {
								fs.truncateSync(self.files[self.connection[socket].remote_addr][0].filename,0);
							}
							if (self.files[self.connection[socket].remote_addr][0].bundle!==null){
								var flodata=fs.readFileSync(self.files[self.connection[socket].remote_addr][0].bundle);
								var re = new RegExp('((?:[\\n\\r]|.)*).('+self.files[self.connection[socket].remote_addr][0].filename+')((?:[\\n\\r]))');
								var res=flodata.toString().match(re);
								if (res!==null){
									fs.writeFileSync(self.files[self.connection[socket].remote_addr][0].bundle,res[1]+res[3]);
								}
							}
							self.files[self.connection[socket].remote_addr].splice(0,1);
							if (self.files[self.connection[socket].remote_addr].length>0){
								self.sendFile(self,socket);
							}else {
								if (self.connection[socket].remote_done){
									self.send(self,socket,new Buffer([128,1,5]));
								}
							}
						}
					}else {
								if (self.connection[socket].remote_done){
									self.send(self,socket,new Buffer([128,1,5]));
								}
					}
				} else if (type==8) {
					callback(data.toString(null,i,i+len-1));
				} else if (type==9) {
//					console.log('9 '+data.toString(null,i,i+len-1));
					var sfile=data.toString(null,i,i+len-1).split(' ');
//					console.log(self.files);
//					console.log(sfile[3]);
					if (sfile[3]>=0 && sfile[3]<=self.files[self.connection[socket].remote_addr][0].size){
						self.connection[socket].sprogress=parseInt(sfile[3]);
						self.connection[socket].sfileFD=fs.openSync(self.files[self.connection[socket].remote_addr][0].filename,'r');
						var answer3=new Buffer(len+2);
						answer3[0]=128;
						answer3[1]=data.toString(null,i,i+len-1).length+1;
						answer3[2]=3;
						new Buffer(sfile[0]+' '+sfile[1]+' '+sfile[2]+' '+sfile[3]).copy(answer3,3);
						self.send(self,socket,answer3);
//						console.log(answer3);
//							console.log(answer3.toString());
//							console.log(sfile[0]+' '+sfile[1]+' '+sfile[2]+' 1');
							self.send(self,socket);
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

//				console.log(data.slice(i));

			var str2;
			var answer2;
			if (data.length-2==self.connection[socket].file[1]) {
				fs.writeSync(self.connection[socket].fileFD,data,2,data.length-2);
				fs.closeSync(self.connection[socket].fileFD);
				console.log(self.connection[socket].file[0]+' file received');
				str2=self.connection[socket].file[0]+' '+self.connection[socket].file[1]+' '+self.connection[socket].file[2];
				answer2=new Buffer(str2.length+3);
				answer2[0]=128;
				answer2[1]=str2.length+1;
				answer2[2]=6;
				new Buffer(str2).copy(answer2,3);
//					console.log(answer2);
				self.send(self,socket,answer2);
				self.stage=1;
				i=data.length;
			} else {
				if (self.connection[socket].chunk===0){
					self.connection[socket].chunk=data.readUInt16BE(i);
					if (self.connection[socket].chink===0){callback('3');}
					i+=2;
					if (data.slice(i,i+self.connection[socket].chunk).length==self.connection[socket].chunk) {
						fs.writeSync(self.connection[socket].fileFD,data,i,self.connection[socket].chunk);
						self.connection[socket].progress-=self.connection[socket].chunk;
						i=i+self.connection[socket].chunk;
						self.connection[socket].chunk=0;
					}else {
						fs.writeSync(self.connection[socket].fileFD,data,i,data.slice(i,i+self.connection[socket].chunk).length);
						self.connection[socket].progress-=data.slice(i,i+self.connection[socket].chunk).length;
						self.connection[socket].chunk-=data.slice(i,i+self.connection[socket].chunk).length;
						i=data.length;
					}
				}else {
					fs.writeSync(self.connection[socket].fileFD,data,i,self.connection[socket].chunk);
					self.connection[socket].progress-=self.connection[socket].chunk;
					i+=self.connection[socket].chunk;
					self.connection[socket].chunk=0;
				}
				if (self.connection[socket].progress===0){
					fs.closeSync(self.connection[socket].fileFD);
//						console.log(self.file[0]+' file write');
					str2=self.connection[socket].file[0]+' '+self.connection[socket].file[1]+' '+self.connection[socket].file[2];
					answer2=new Buffer(str2.length+3);
					answer2[0]=128;
					answer2[1]=str2.length+1;
					answer2[2]=6;
					new Buffer(str2).copy(answer2,3);
					self.send(self,socket,answer2);
					self.stage=1;
				}
			}
		}
	}
	if (self.stage===0){
		if (('OPT' in self.connection[socket].rgain) && (self.connection[socket].rgain.addr.length>0)){
			self.makeAnswer(self,callback,socket);
		}
	}
};
BinkPc.prototype.checkPasswd=function(self,hash,socket){
	var chal=new Buffer(self.connection[socket].challenge,'hex');
	self.connection[socket].rgain.addr.forEach(function(addr){
		if (self.nAddress(addr) in self.remoteinfo){
			var hmac=crypto.createHmac('md5',self.remoteinfo[self.nAddress(addr)].password);
			hmac.update(chal);
			if (hmac.digest('hex')==hash){
				console.log('auth!!!');
				self.connection[socket].remote_addr=self.nAddress(addr);
				self.emit('auth',self.connection[socket].rgain);
				var trf=0;
				self.files[self.connection[socket].remote_addr].forEach(function(file){
					trf+=file.size;
				});
				self.send(self,socket,self.makePkt(self,'TRF','0 '+trf));
				self.send(self,socket,self.makePkt(self,'OPT','NDA NR BM CRYPT'));
				self.send(self,socket,new Buffer([128,1,4]));
				self.connection[socket].keyin=crypt(self.remoteinfo[self.connection[socket].remote_addr].password);
				self.connection[socket].keyin.init_keys();
				self.connection[socket].keyout=crypt('-'+self.remoteinfo[self.connection[socket].remote_addr].password);
				self.connection[socket].keyout.init_keys();
				if (self.connection[socket].rgain.OPT.search(/CRYPT/)){
					self.connection[socket].crypt=true;
				}
			}
		}
	});
//	
//	var hmac=crypto.createHmac('md5',self.remoteinfo.password);
//							hmac.update(chal);
};
BinkPc.prototype.hashPWD=function(self,callback,socket){
	var answer=new Buffer([128,42,2]);
	if (self.connection[socket].rgain.OPT.substr(0,8)!='CRAM-MD5'){
		callback('unknown challenge '+self.connection[socket].rgain.OPT);
	}
	var chal=new Buffer(self.connection[socket].rgain.OPT.substr(9),'hex');
	var hmac=crypto.createHmac('md5',self.remoteinfo[self.connection[socket].remote_addr].password);
	hmac.update(chal);
//	console.log(hmac.digest('hex'));
	//	console.log(chal);
	return Buffer.concat([answer,new Buffer(('CRAM-MD5-'+hmac.digest('hex')))]);
};
BinkPc.prototype.makePkt=function(self,name,data){
	var buf=new Buffer(data.length+name.length+4);
	buf[0]=128;//SYS
	buf[1]=data.length+name.length+2;
	buf[2]=0;
	new Buffer(name).copy(buf,3);
	buf[name.length+3]=32;
	new Buffer(data).copy(buf,name.length+4);
	return buf;
};
BinkPc.prototype.makeAnswer=function(self,callback,socket){
	if (!self.mode) {
		var found=false;
		self.connection[socket].rgain.addr.forEach(function(addr){
			Object.keys(self.remoteinfo).forEach(function(raddr){
				if (self.Address_equal(raddr,addr)){found=true;
					self.connection[socket].remote_addr=raddr;
				}
			});
		});
		if (!found){
			self.client.destroy();
			callback('not needed address on remote');
		}
	}
	var buf=new Buffer(0);
	if (self.mode) {
		buf=Buffer.concat([buf,self.makePkt(self,'OPT','CRAM-MD5-'+self.connection[socket].challenge)]);
	}
	buf=Buffer.concat([buf,self.makePkt(self,'SYS',self.myinfo.sysname)]);
	buf=Buffer.concat([buf,self.makePkt(self,'ZYZ',self.myinfo.sysop)]);
	buf=Buffer.concat([buf,self.makePkt(self,'LOC',self.myinfo.location)]);
	buf=Buffer.concat([buf,self.makePkt(self,'NDL',self.myinfo.nodeinfo)]);
	buf=Buffer.concat([buf,self.makePkt(self,'VER','nbinkp/0.0.1 binkp/1.1')]);
	if (!self.mode) {
		buf=Buffer.concat([buf,self.makePkt(self,'OPT','NDA NR BM CRYPT')]);
		var trf=0;
		console.log(self.connection[socket].remote_addr);
		self.files[self.connection[socket].remote_addr].forEach(function(file){
			trf+=file.size;
		});
		buf=Buffer.concat([buf,self.makePkt(self,'TRF','0 '+trf)]);
	}
//	console.log(self.myinfo.address.join(' '));
	addb=new Buffer(self.myinfo.address.join(' ').length+3);
	addb[0]=128;addb[1]=self.myinfo.address.join(' ').length+1;addb[2]=1;
	new Buffer(self.myinfo.address.join(' ')).copy(addb,3);
	buf=Buffer.concat([buf,addb]);
	if (!self.mode) {
		self.connection[socket].keyin=crypt('-'+self.remoteinfo[self.connection[socket].remote_addr].password);
		self.connection[socket].keyin.init_keys();
		self.connection[socket].keyout=crypt(self.remoteinfo[self.connection[socket].remote_addr].password);
		self.connection[socket].keyout.init_keys();
		buf=Buffer.concat([buf,self.hashPWD(self,callback,socket)]);
	}
	self.send(self,socket,buf);
	self.stage=1;
};
BinkPc.prototype.send=function(self,socket,data) {
	if (self.connection[socket].crypt){
		data=self.connection[socket].keyout.encrypt_buf(data);
	}
	socket.write(data);
};
module.exports=BinkPc;

import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {connectCDP} from '../skills/taskobo-diagrams/scripts/render.mjs';

test('CDP disconnect rejects calls and page waits promptly, including requests made after closure',async t=>{
  const server=createServer();const sockets=new Set();
  server.on('upgrade',(request,socket)=>{
    sockets.add(socket);socket.on('close',()=>sockets.delete(socket));
    const accept=createHash('sha1').update(request.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
    socket.once('data',()=>socket.end(Buffer.from([0x88,0x02,0x03,0xe8])));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));});
  const cdp=await connectCDP('ws://127.0.0.1:'+server.address().port),start=Date.now();
  const waiting=assert.rejects(cdp.wait('Page.loadEventFired','session'),{code:'BROWSER_DISCONNECTED'});
  await assert.rejects(cdp.send('Runtime.evaluate',{},'session',10000),{code:'BROWSER_DISCONNECTED'});await waiting;
  await assert.rejects(cdp.send('Browser.close'),{code:'BROWSER_DISCONNECTED'});
  await assert.rejects(cdp.wait('Page.loadEventFired','session'),{code:'BROWSER_DISCONNECTED'});
  assert(Date.now()-start<2000,'Disconnected browser must not leave a 180-second cleanup wait');cdp.close();
});

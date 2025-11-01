#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const flagPath = path.join(__dirname, '..', 'public', 'test-build.flag');

function on(){
  try{
    fs.writeFileSync(flagPath, 'TEST', 'utf8');
    console.log('Test build flag created at', flagPath);
  }catch(e){
    console.error('Failed to create test flag:', e.message);
    process.exit(1);
  }
}

function off(){
  try{
    if(fs.existsSync(flagPath)) fs.unlinkSync(flagPath);
    console.log('Test build flag removed from', flagPath);
  }catch(e){
    console.error('Failed to remove test flag:', e.message);
    process.exit(1);
  }
}

const mode = (process.argv[2]||'').toLowerCase();
if(mode === 'on') on();
else if(mode === 'off') off();
else { console.log('Usage: node tools/test-build-flag.js on|off'); process.exit(1); }


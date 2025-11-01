// Toggle a build-embedded flag to force first-run cleanup in packaged apps
const fs = require('fs');
const path = require('path');

const mode = process.argv[2] || '';
const flagPath = path.join(__dirname, '..', 'public', 'force-clean.flag');

function on(){
  try{
    fs.writeFileSync(flagPath, 'force-initial-clean=1', 'utf8');
    console.log('Force-clean flag created at', flagPath);
  }catch(e){
    console.error('Failed to create force-clean flag:', e.message);
    process.exitCode = 1;
  }
}

function off(){
  try{
    if(fs.existsSync(flagPath)){
      fs.unlinkSync(flagPath);
      console.log('Force-clean flag removed from', flagPath);
    } else {
      console.log('No force-clean flag to remove at', flagPath);
    }
  }catch(e){
    console.error('Failed to remove force-clean flag:', e.message);
    process.exitCode = 1;
  }
}

if(mode === 'on') on();
else if(mode === 'off') off();
else {
  console.log('Usage: node tools/force-clean-flag.js <on|off>');
}


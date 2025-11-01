const fs = require('fs');
const path = require('path');

function rm(dir){
  try{
    if(fs.existsSync(dir)){
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`Removed old output: ${dir}`);
    }else{
      console.log(`No previous output found: ${dir}`);
    }
  }catch(e){
    console.error(`Failed to remove ${dir}:`, e.message);
    process.exitCode = 1;
  }
}

const winOut = path.join(__dirname, '..', 'App Dist Windows');
rm(winOut);


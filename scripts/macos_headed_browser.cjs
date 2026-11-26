'use strict';
// Test-only launch configuration. Assertions and application code are unchanged.
// On macOS run the same user flows in visible native Chromium windows.
if(process.platform!=='darwin')throw Error('macOS GUI acceptance requires a macOS host');
const {chromium,webkit}=require('playwright');
const engine=process.env.STUDIO_MAC_ENGINE==='webkit'?webkit:chromium,launch=engine.launch.bind(engine);
chromium.launch=options=>{const args={...options,headless:false};delete args.channel;return launch(args);};

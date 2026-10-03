const fs = require('fs');
let content = fs.readFileSync('lib/actions/booking.ts', 'utf8');

// Fix the mistakes in lines 68 and 114
content = content.replace(/const bEnd = bStart \+ \(bDur \* booking\.sessionCount \* 60 \* 1000\);/g, 'const bEnd = bStart + (bDur * b.sessionCount * 60 * 1000);');

fs.writeFileSync('lib/actions/booking.ts', content);

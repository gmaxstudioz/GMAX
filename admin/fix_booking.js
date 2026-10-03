const fs = require('fs');
let content = fs.readFileSync('lib/actions/booking.ts', 'utf8');

content = content.replace(/data: newBooking/g, 'data: booking');
content = content.replace(/if \(!b\) /g, 'if (!booking) ');
content = content.replace(/memberData\.role/g, 'member.role');
content = content.replace(/memberId \}/g, 'memberId: targetMemberId }');
content = content.replace(/\(b\.service/g, '(booking.service');
content = content.replace(/\* b\.sessionCount/g, '* booking.sessionCount');
content = content.replace(/if \(!p\) /g, 'if (!photo) ');
content = content.replace(/p\.r2Key/g, 'photo.r2Key');
content = content.replace(/b\.sessionCount/g, 'booking.sessionCount');

fs.writeFileSync('lib/actions/booking.ts', content);

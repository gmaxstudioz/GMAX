with open("lib/schema.ts", "r") as f:
    content = f.read()

content = content.replace(
    "updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull()",
    "updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull()"
)

with open("lib/schema.ts", "w") as f:
    f.write(content)

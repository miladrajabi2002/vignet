
import { PrismaClient } from '@prisma/client'
import { decrypt } from '@/lib/crypto'

const prisma = new PrismaClient()

const SENDER_ID = '27559774387035497'
const CHANNEL_ID = 'cmtmp7ewt007oeotku7d2t3vj'
const CONTACT_ID = 'cmtn1kts_backfill_001'

async function main() {
  const channel = await prisma.agentChannel.findUnique({
    where: { id: CHANNEL_ID },
    select: { config: true }
  })
  if (!channel) { console.error('Channel not found'); process.exit(1) }
  
  const config = channel.config as any
  console.log('Channel mode:', config.mode)
  console.log('botUsername:', config.botUsername)
  console.log('igUserId:', config.igUserId)
  
  if (!config.userTokenEnc) {
    console.error('No userTokenEnc in config')
    process.exit(1)
  }
  
  const token = decrypt(config.userTokenEnc)
  console.log('Token decrypted, length:', token.length)
  console.log('Token prefix:', token.substring(0, 15) + '...')
  
  const fieldSets = [
    'name,username,profile_pic',
    'name,username,profile_picture_url',
    'username,profile_picture_url',
    'username,name',
  ]
  
  for (const fields of fieldSets) {
    try {
      const url = `https://graph.instagram.com/v21.0/${SENDER_ID}?fields=${fields}`
      console.log(`\nTrying: ${url}`)
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      })
      const bodyText = await res.text()
      console.log(`Status: ${res.status}`)
      console.log(`Body: ${bodyText.slice(0, 500)}`)
      
      if (!res.ok) continue
      const json = JSON.parse(bodyText)
      if (json.error) continue
      
      const name = typeof json.name === 'string' ? json.name : undefined
      const username = typeof json.username === 'string' ? json.username : undefined
      const avatarUrl = 
        (typeof json.profile_pic === 'string' ? json.profile_pic : undefined) ??
        (typeof json.profile_picture_url === 'string' ? json.profile_picture_url : undefined)
      
      if (name || username || avatarUrl) {
        console.log(`\n✓ SUCCESS: name=${name} username=${username} avatar=${avatarUrl ? 'yes' : 'no'}`)
        
        const updateData: any = { lastActivityAt: new Date() }
        if (name) updateData.name = name
        if (username) updateData.instagramUsername = username
        if (avatarUrl) updateData.instagramAvatarUrl = avatarUrl
        
        await prisma.contact.update({
          where: { id: CONTACT_ID },
          data: updateData,
        })
        console.log('✓ Contact updated successfully')
        return
      }
    } catch (e) {
      console.log('Error:', (e as Error).message)
    }
  }
  
  console.log('\n✗ All field sets failed - this sender may not be reachable via IG User Token')
  console.log('Note: IG User Tokens can only fetch profiles of users who have messaged the connected account.')
  console.log('The sender ID might be the IG-scoped ID, which requires the user to have interacted.')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())

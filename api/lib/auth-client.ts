import { createAuthClient } from "better-auth/client"
import { organizationClient, phoneNumberClient } from "better-auth/client/plugins"
import { developer, manager, owner, photographer, receptionist, studioAc, videographer } from "./permissions"

export const authClient = createAuthClient({
    plugins: [
        phoneNumberClient(),
        organizationClient({
            ac: studioAc,
            roles: {
                manager,
                owner,
                developer,
                photographer,
                videographer,
                receptionist,
            }
        })
    ],
    baseURL: process.env.NEXT_PUBLIC_AUTH_URL,
})

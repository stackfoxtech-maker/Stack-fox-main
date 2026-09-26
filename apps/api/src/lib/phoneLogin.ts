import { prisma } from "@stackfox/prisma";

/**
 * The user a phone-based sign-in (SMS OTP or WhatsApp) may log into.
 *
 * `user.phone` is not proof of ownership: signup and the profile page accept a
 * number without an SMS check, and the column is not unique. Matching on it
 * alone would let someone type a stranger's number at signup and receive that
 * stranger's later phone login. So only a number proven by a code counts:
 * one flagged `phoneVerified`, or an account that was itself created by a
 * phone login (those were verified by the code that created them).
 */
export function findPhoneLoginUser(phone: string) {
  return prisma.user.findFirst({
    where: {
      phone,
      OR: [
        { authData: { path: ["phoneVerified"], equals: true } },
        { email: { endsWith: "@phone.stackfox.in" } },
        { email: { endsWith: "@wa.stackfox.in" } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
}

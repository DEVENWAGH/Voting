import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db';
import Organization from '@/lib/models/Organization';

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),

    Credentials({
      name: 'Email & Password',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();
        const org = await Organization.findOne({
          adminEmail: credentials.email.toLowerCase().trim(),
        });

        if (!org || !org.passwordHash) return null;

        if (!org.isEmailVerified) return null; // Must verify email first

        const valid = await bcrypt.compare(String(credentials.password), org.passwordHash);
        if (!valid) return null;

        return {
          id:      org._id.toString(),
          email:   org.adminEmail,
          name:    org.name,
          orgSlug: org.slug,
          orgId:   org._id.toString(),
          image:   org.logoUrl || null,
        };
      },
    }),
  ],

  pages: {
    signIn: '/login',
    error:  '/login',
  },

  callbacks: {
    async signIn({ user, account }) {
      // For Google OAuth: upsert org record keyed by google email
      if (account?.provider === 'google') {
        await connectDB();
        let org = await Organization.findOne({ adminEmail: user.email.toLowerCase() });
        if (!org) {
          // Create a minimal org record so the user can complete setup later
          const slug = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
          let finalSlug = slug;
          let counter = 1;
          while (await Organization.exists({ slug: finalSlug })) {
            finalSlug = `${slug}-${counter++}`;
          }
          org = await Organization.create({
            name:            user.name || user.email.split('@')[0],
            slug:            finalSlug,
            adminEmail:      user.email.toLowerCase(),
            googleId:        user.id,
            isEmailVerified: true, // Google OAuth accounts are pre-verified
          });
        } else if (!org.googleId) {
          org.googleId = user.id;
          org.isEmailVerified = true;
          await org.save();
        }
        // Attach org info to user object
        user.orgSlug = org.slug;
        user.orgId   = org._id.toString();
        user.name    = org.name;
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.orgSlug = user.orgSlug;
        token.orgId   = user.orgId;
        token.name    = user.name;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.orgSlug = token.orgSlug;
      session.user.orgId   = token.orgId;
      session.user.name    = token.name;
      return session;
    },
  },

  session: { strategy: 'jwt' },
});

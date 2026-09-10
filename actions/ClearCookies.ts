'use server';
import { cookies } from 'next/headers';
export async function clearCookies() {
  const cookieStore = await cookies();
  cookieStore.getAll().forEach((cookie) => {
    cookieStore.set(cookie.name, '', {
      path: '/',
      maxAge: 0,
    });
  });
}

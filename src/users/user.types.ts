/** Hình dạng `User` trong spec (api-response-format.md#users-for-authentication). */
export interface UserView {
  email: string;
  token: string;
  username: string;
  bio: string | null;
  image: string | null;
}

/** Body trả về của các endpoint user: {"user": {...}}. */
export interface UserEnvelope {
  user: UserView;
}

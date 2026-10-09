export type CustomerPortalRole = 'CUSTOMER_OWNER' | 'CUSTOMER_ADMIN' | 'CUSTOMER_USER';

export type CustomerPortalUser = {
  uuid: string;
  customerUUID: string;
  environmentUUID: string;
  name: string | null;
  email: string;
  username?: string | null;
  role: CustomerPortalRole;
  mustChangePassword: boolean;
  tokenUUID: string | null;
};

export type AuthResponse = {
  status: 'success';
  message: string;
  data: {
    user: CustomerPortalUser;
    jwt: string;
  };
  duration: string;
};

export type ApiEnvelope<T> = {
  status: 'success';
  message: string;
  data: T;
  duration: string;
};

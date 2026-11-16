// Offline first-account provisioning. No default credentials or public admin signup.
import { Store } from '../server/db.mjs';
import { validatePasswordPolicy } from '../server/auth/password.mjs';
const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
if (!email || !validatePasswordPolicy(password).valid) throw new Error('Set ADMIN_EMAIL and a policy-compliant ADMIN_PASSWORD (12+ characters).');
const store = new Store();
try {
  if(store.db.prepare("SELECT id FROM system_users WHERE role='admin'").get()) throw new Error('An administrator already exists; use authenticated invitations.');
  const user = store.registerUser({email,password,name:process.env.ADMIN_NAME || 'System Administrator',role:'admin'});
  console.log(JSON.stringify({id:user.id,email:user.email,role:user.role}));
} finally {store.close();}

const DEVICE_ID_KEY = 'dm_device_id';

// One UUID per browser, generated once and reused forever — recorded on
// every offline-sync operation so sync_operations rows carry which device
// made each write, for audit/debugging only (see schema.sql's sync_* RPCs;
// it never restricts who may finish/edit a match, only who gets credited).
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

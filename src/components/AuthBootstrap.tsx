/**
 * Shared Hopenity auth is intentionally NOT auto-promoted into Redux.
 *
 * Wrong shared accounts make the chat API return empty/wrong data. The login
 * screen reads the shared vault and asks the user to tap Continue with the
 * visible Hopenity account before we accept that session.
 */
const AuthBootstrap = () => {
  return null;
};

export default AuthBootstrap;

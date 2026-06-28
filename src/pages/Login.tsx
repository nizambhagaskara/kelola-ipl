import { useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import HeroPng from '../assets/hero.png';

const FAKE_EMAIL_DOMAIN = '@ipl.local';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleLogin(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: username.trim().toLowerCase() + FAKE_EMAIL_DOMAIN,
      password,
    });

    if (error) {
      setLoginError('Username/password salah');
      return;
    }

    // Login sukses -> pindah ke dashboard
    navigate('/');
  }

  return (
    <div className="w-screen h-screen flex flex-col justify-center items-center">
      <img src={HeroPng} alt="KelolaIPL" className="w-32 h-32" />
      <div className="max-w-xs mt-20 font-sans flex flex-col justify-center items-center">
        <h1 className="text-xl font-semibold mb-4 text-center">Login</h1>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
          {loginError && <p className="text-red-600 text-sm">{loginError}</p>}
          <button
            type="submit"
            className="w-full bg-gray-900 text-white rounded-lg px-3 py-2 hover:bg-gray-700 mt-4"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
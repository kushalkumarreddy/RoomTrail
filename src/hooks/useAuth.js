import { useAuth as useAuthContext } from '../context/AuthContext';

/**
 * Custom hook to access authentication state and operations
 */
export const useAuth = () => {
  return useAuthContext();
};

export default useAuth;

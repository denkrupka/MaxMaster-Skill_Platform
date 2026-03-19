import { useAppContext } from '../context/AppContext'

export function useAuth() {
  const { state } = useAppContext()
  return { user: state.currentUser }
}

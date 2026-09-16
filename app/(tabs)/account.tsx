import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { supabase } from '../../lib/supabase'

// TODO: replace with real hosted URLs before store submission
const PRIVACY_POLICY_URL = ''
const TERMS_OF_SERVICE_URL = ''

export default function Account() {
  const [email, setEmail] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setEmail(user?.email ?? null)
    }
    fetchUser()
  }, [])

  function handleLogout() {
    Alert.alert('Odjava', 'Da li ste sigurni da želite da se odjavite?', [
      { text: 'Otkaži', style: 'cancel' },
      {
        text: 'Odjavi se',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.auth.signOut()
          if (error) {
            Alert.alert('Greška', error.message)
          } else {
            router.replace('/login')
          }
        },
      },
    ])
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Brisanje naloga',
      'Ova akcija je trajna i ne može se opozvati. Vaš nalog će biti trajno obrisan. Da li ste sigurni?',
      [
        { text: 'Otkaži', style: 'cancel' },
        { text: 'Obriši nalog', style: 'destructive', onPress: confirmDeleteAccount },
      ]
    )
  }

  async function confirmDeleteAccount() {
    setDeleting(true)
    const { error } = await supabase.functions.invoke('delete-account')

    if (error) {
      setDeleting(false)
      Alert.alert('Greška', error.message)
      return
    }

    await supabase.auth.signOut()
    setDeleting(false)
    router.replace('/login')
  }

  function openLink(url: string) {
    if (!url) {
      Alert.alert('Nedostupno', 'Ova stranica trenutno nije dostupna.')
      return
    }
    WebBrowser.openBrowserAsync(url)
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Nalog</Text>

      {email && (
        <View style={styles.card}>
          <Text style={styles.info}>Prijavljeni ste kao</Text>
          <Text style={styles.email}>{email}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.row} onPress={handleLogout}>
        <Text style={styles.rowText}>Odjavi se</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => openLink(PRIVACY_POLICY_URL)}>
        <Text style={styles.rowText}>Politika privatnosti</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => openLink(TERMS_OF_SERVICE_URL)}>
        <Text style={styles.rowText}>Uslovi korišćenja</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.row, styles.dangerRow]}
        onPress={handleDeleteAccount}
        disabled={deleting}
      >
        {deleting ? (
          <ActivityIndicator color="#D64545" />
        ) : (
          <Text style={styles.dangerText}>Obriši nalog</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.version}>Verzija {Constants.expoConfig?.version ?? '—'}</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  info: { fontSize: 13, color: '#666', marginBottom: 4 },
  email: { fontSize: 16, fontWeight: '600' },
  row: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  rowText: { fontSize: 16, color: '#2D6A4F', fontWeight: '500' },
  dangerRow: { marginTop: 10 },
  dangerText: { fontSize: 16, color: '#D64545', fontWeight: '600' },
  version: { textAlign: 'center', color: '#999', fontSize: 12, marginTop: 20, marginBottom: 20 },
})

import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { supabase } from '../../lib/supabase'

type Usluga = {
  id: string
  naziv: string
  trajanje_min: number
  cena: number
}

export default function Treatments() {
  const [usluge, setUsluge] = useState<Usluga[]>([])
  const router = useRouter()

  useEffect(() => {
    async function fetchUsluge() {
      const { data, error } = await supabase.from('usluge').select('*')
      if (!error) setUsluge(data)
    }
    fetchUsluge()
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Usluge</Text>
      <FlatList
        data={usluge}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.naziv}>{item.naziv}</Text>
              <Text style={styles.info}>⏱ {item.trajanje_min} min</Text>
              <Text style={styles.info}>💰 {item.cena} RSD</Text>
            </View>
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.push(`/booking?uslugaId=${item.id}&naziv=${item.naziv}&trajanje=${item.trajanje_min}`)} 
            >
              <Text style={styles.buttonText}>Zakaži</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  cardInfo: { flex: 1 },
  naziv: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  info: { fontSize: 14, color: '#666' },
  button: {
    backgroundColor: '#2D6A4F',
    padding: 10,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: 'bold' },
})
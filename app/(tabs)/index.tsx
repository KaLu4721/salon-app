import { useEffect, useState } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { supabase } from '../../lib/supabase'

type Usluga = {
  id: string
  naziv: string
  trajanje_min: number
  cena: number
}

export default function Home() {
  const [usluge, setUsluge] = useState<Usluga[]>([])

  useEffect(() => {
    async function fetchUsluge() {
      const { data, error } = await supabase.from('usluge').select('*')
      if (!error) setUsluge(data)
    }
    fetchUsluge()
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Naše usluge</Text>
      <FlatList
        data={usluge}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.naziv}>{item.naziv}</Text>
            <Text style={styles.info}>⏱ {item.trajanje_min} min</Text>
            <Text style={styles.info}>💰 {item.cena} RSD</Text>
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
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  naziv: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  info: { fontSize: 14, color: '#666' },
})
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Calendar as RNCalendar } from 'react-native-calendars'
import { supabase } from '../../lib/supabase'

type Termin = {
  id: string
  datum_vreme: string
  kraj_vreme: string
  status: string
  usluge: { naziv: string; cena: number } | null
  frizeri: { ime: string; prezime: string } | null
}

export default function Calendar() {
  const [termini, setTermini] = useState<Termin[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDatum, setSelectedDatum] = useState<string>(
    new Date().toISOString().split('T')[0]
  )

  function lokalniDatumString(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  function formatVreme(iso: string) {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  async function fetchTermini() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('termini')
      .select('id, datum_vreme, kraj_vreme, status, usluge(naziv, cena), frizeri(ime, prezime)')
      .eq('korisnik_id', user.id)
      .eq('status', 'aktivan')
      .order('datum_vreme', { ascending: true })

    if (!error && data) {
      setTermini(data as any)
    } else if (error) {
      console.log('Greška pri učitavanju termina:', error)
    }
    setLoading(false)
  }

  // Ponovo učitaj termine svaki put kad se stranica fokusira (npr. posle novog bookinga)
  useFocusEffect(
    useCallback(() => {
      fetchTermini()
    }, [])
  )

  function generisiMarkedDates() {
    const marked: any = {}

    termini.forEach((t) => {
      const datumStr = lokalniDatumString(new Date(t.datum_vreme))
      marked[datumStr] = {
        marked: true,
        dotColor: '#2D6A4F',
      }
    })

    marked[selectedDatum] = {
      ...marked[selectedDatum],
      selected: true,
      selectedColor: '#2D6A4F',
    }

    return marked
  }

  const terminiZaDan = termini.filter(
    (t) => lokalniDatumString(new Date(t.datum_vreme)) === selectedDatum
  )

  async function handleOtkazi(id: string) {
    Alert.alert('Otkaži termin', 'Da li ste sigurni da želite da otkažete ovaj termin?', [
      { text: 'Ne', style: 'cancel' },
      {
        text: 'Da, otkaži',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('termini')
            .update({ status: 'otkazan' })
            .eq('id', id)

          if (error) {
            Alert.alert('Greška', error.message)
          } else {
            fetchTermini()
          }
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Moji termini</Text>

      <RNCalendar
        onDayPress={(day: any) => setSelectedDatum(day.dateString)}
        markedDates={generisiMarkedDates()}
        theme={{ todayTextColor: '#2D6A4F', arrowColor: '#2D6A4F' }}
      />

      <Text style={styles.sectionTitle}>
        Termini za {selectedDatum.split('-').reverse().join('.')}
      </Text>

      {terminiZaDan.length === 0 ? (
        <Text style={styles.info}>Nema zakazanih termina za ovaj dan.</Text>
      ) : (
        terminiZaDan.map((t) => (
          <View key={t.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardVreme}>
                {formatVreme(t.datum_vreme)} - {formatVreme(t.kraj_vreme)}
              </Text>
              <TouchableOpacity onPress={() => handleOtkazi(t.id)}>
                <Text style={styles.otkaziText}>Otkaži</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.cardUsluga}>{t.usluge?.naziv ?? 'Usluga'}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardFrizer}>
                {t.frizeri ? `${t.frizeri.ime} ${t.frizeri.prezime}` : ''}
              </Text>
              {t.usluge?.cena != null && (
                <Text style={styles.cardCena}>{t.usluge.cena} RSD</Text>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 20 },
  info: { fontSize: 14, color: '#999', fontStyle: 'italic', marginTop: 5 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardVreme: { fontSize: 15, fontWeight: 'bold', color: '#2D6A4F' },
  otkaziText: { fontSize: 13, color: '#D64545', fontWeight: '600' },
  cardUsluga: { fontSize: 15, fontWeight: '500', marginBottom: 4 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardFrizer: { fontSize: 13, color: '#666' },
  cardCena: { fontSize: 13, color: '#2D6A4F', fontWeight: '600' },
})

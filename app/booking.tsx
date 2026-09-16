import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Calendar } from 'react-native-calendars'
import { supabase } from '../lib/supabase'

type Frizer = {
  id: string
  ime: string
  prezime: string
}

type Termin = {
  datum_vreme: string
  kraj_vreme: string
}

const RADNO_OD = 9 * 60   // 09:00 u minutima
const RADNO_DO = 17 * 60  // 17:00 u minutima
const KORAK = 20          // satnice na 20 min
const BROJ_DANA_UNAPRED = 30

export default function Booking() {
  const { uslugaId, naziv, trajanje } = useLocalSearchParams()
  const [frizeri, setFrizeri] = useState<Frizer[]>([])
  const [selectedFrizer, setSelectedFrizer] = useState<string | null>(null)
  const [selectedDatum, setSelectedDatum] = useState<string | null>(null)
  const [selectedVreme, setSelectedVreme] = useState<string | null>(null)
  const [zauzetiTermini, setZauzetiTermini] = useState<Termin[]>([])
  const [loadingTermini, setLoadingTermini] = useState(false)
  const router = useRouter()

  const danas = new Date().toISOString().split('T')[0]
  const trajanjeMin = Number(trajanje) || 30

  function minuteUVreme(min: number) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  // Formatira Date objekat u lokalni YYYY-MM-DD string (isti format koji koristi Calendar)
  function lokalniDatumString(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  // Dohvati frizere koji rade odabranu uslugu
  useEffect(() => {
    async function fetchFrizeri() {
      const { data, error } = await supabase
        .from('frizer_usluge')
        .select('frizer_id, frizeri(id, ime, prezime)')
        .eq('usluga_id', uslugaId)

      if (!error && data) {
        const lista = data.map((d: any) => d.frizeri).filter(Boolean)
        setFrizeri(lista)
      }
    }
    fetchFrizeri()
  }, [uslugaId])

  // Dohvati SVE termine frizera za narednih 30 dana (jednom, kad se izabere frizer)
  useEffect(() => {
    if (selectedFrizer) {
      fetchZauzetiTermini(selectedFrizer)
      setSelectedDatum(null)
      setSelectedVreme(null)
    }
  }, [selectedFrizer])

  // Koristi RPC funkciju (get_zauzeta_vremena) umesto direktnog .from('termini').select(),
  // jer nakon uključivanja RLS-a korisnik ne sme da čita tuđe termine direktno.
  // Funkcija je SECURITY DEFINER i vraća samo vremena, bez korisnik_id.
  async function fetchZauzetiTermini(frizerId: string) {
    setLoadingTermini(true)
    const sada = new Date()
    const krajOpsega = new Date(sada.getTime() + BROJ_DANA_UNAPRED * 86400000)

    const { data, error } = await supabase.rpc('get_zauzeta_vremena', {
      p_frizer_id: frizerId,
      p_od: sada.toISOString(),
      p_do: krajOpsega.toISOString(),
    })

    if (!error && data) setZauzetiTermini(data)
    else if (error) console.log('Greška pri dohvatanju zauzetih termina:', error)
    setLoadingTermini(false)
  }

  // Generiši slobodne satnice za odabrani dan (preklapanje se proverava ovde)
  function slobodneSatniceZaDan(datum: string) {
    const terminiTogDana = zauzetiTermini.filter((t) => {
      const d = new Date(t.datum_vreme)
      return lokalniDatumString(d) === datum
    })

    const sada = new Date()
    const jeIstiDan = lokalniDatumString(sada) === datum
    const trenutneMinute = sada.getHours() * 60 + sada.getMinutes()

    const slobodne: string[] = []
    for (let min = RADNO_OD; min + trajanjeMin <= RADNO_DO; min += KORAK) {
      const noviPocetak = min
      const noviKraj = min + trajanjeMin

      // Preskoči satnice koje su već prošle (samo za današnji dan)
      if (jeIstiDan && noviPocetak <= trenutneMinute) continue

      const preklapaSe = terminiTogDana.some((t) => {
        const pocetakD = new Date(t.datum_vreme)
        const krajD = new Date(t.kraj_vreme)
        // Lokalni sati/minuti — poklapaju se sa lokalnim radnim vremenom
        const postojeciPocetak = pocetakD.getHours() * 60 + pocetakD.getMinutes()
        const postojeciKraj = krajD.getHours() * 60 + krajD.getMinutes()
        return noviPocetak < postojeciKraj && noviKraj > postojeciPocetak
      })

      if (!preklapaSe) slobodne.push(minuteUVreme(min))
    }
    return slobodne
  }

  // Napravi markirane datume za kalendar (zelena tacka = ima slobodnih, crvena = popunjeno)
  function generisiMarkedDates() {
    const marked: any = {}
    const danasD = new Date()

    for (let i = 0; i < BROJ_DANA_UNAPRED; i++) {
      const d = new Date()
      d.setDate(danasD.getDate() + i)
      const datumStr = lokalniDatumString(d)

      const slobodne = slobodneSatniceZaDan(datumStr)
      marked[datumStr] = {
        marked: true,
        dotColor: slobodne.length > 0 ? '#2D6A4F' : '#D64545',
      }
    }

    if (selectedDatum) {
      marked[selectedDatum] = {
        ...marked[selectedDatum],
        selected: true,
        selectedColor: '#2D6A4F',
      }
    }

    return marked
  }

  // Koristi RPC funkciju (postoji_preklapanje) iz istog razloga kao gore —
  // klijent ne sme direktno da čita tuđe termine iz 'termini' tabele kad je RLS uključen.
  async function proveraPostojecegTermina(pocetakISO: string, krajISO: string) {
    const { data, error } = await supabase.rpc('postoji_preklapanje', {
      p_frizer_id: selectedFrizer,
      p_pocetak: pocetakISO,
      p_kraj: krajISO,
    })

    if (error) {
      console.log('Greška pri proveri preklapanja:', error)
      return false
    }
    return !!data
  }

  async function handleBooking() {
    if (!selectedFrizer || !selectedDatum || !selectedVreme) {
      Alert.alert('Greška', 'Molimo odaberite frizera, datum i vreme')
      return
    }

    // Kreirano kao lokalno vreme; toISOString() ga automatski konvertuje u UTC
    const pocetakDate = new Date(`${selectedDatum}T${selectedVreme}:00`)
    const krajDate = new Date(pocetakDate.getTime() + trajanjeMin * 60000)

    const pocetakISO = pocetakDate.toISOString()
    const krajISO = krajDate.toISOString()

    const postoji = await proveraPostojecegTermina(pocetakISO, krajISO)
    if (postoji) {
      Alert.alert('Greška', 'Ovaj termin je upravo zauzet, molimo odaberite drugo vreme')
      await fetchZauzetiTermini(selectedFrizer)
      setSelectedVreme(null)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('termini').insert({
      korisnik_id: user?.id,
      frizer_id: selectedFrizer,
      usluga_id: uslugaId,
      datum_vreme: pocetakISO,
      kraj_vreme: krajISO,
      status: 'aktivan',
    })

    if (error) {
      Alert.alert('Greška', error.message)
    } else {
      Alert.alert('Uspeh!', 'Termin je zakazan!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ])
    }
  }

  const slobodneSatnice = selectedDatum ? slobodneSatniceZaDan(selectedDatum) : []

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Zakaži: {naziv}</Text>
      <Text style={styles.subtitle}>Trajanje: {trajanjeMin} min</Text>

      <Text style={styles.sectionTitle}>Odaberi frizera</Text>
      <View style={styles.row}>
        {frizeri.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.chip, selectedFrizer === f.id && styles.chipSelected]}
            onPress={() => setSelectedFrizer(f.id)}
          >
            <Text style={[styles.chipText, selectedFrizer === f.id && styles.chipTextSelected]}>
              {f.ime} {f.prezime}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {frizeri.length === 0 && (
        <Text style={styles.info}>Nijedan frizer trenutno ne nudi ovu uslugu.</Text>
      )}

      {selectedFrizer && !loadingTermini && (
        <>
          <Text style={styles.sectionTitle}>Odaberi datum</Text>
          <Text style={styles.legenda}>🟢 ima slobodnih termina 🔴 popunjeno</Text>
          <Calendar
            minDate={danas}
            maxDate={new Date(Date.now() + BROJ_DANA_UNAPRED * 86400000).toISOString().split('T')[0]}
            onDayPress={(day: any) => {
              setSelectedDatum(day.dateString)
              setSelectedVreme(null)
            }}
            markedDates={generisiMarkedDates()}
            theme={{ todayTextColor: '#2D6A4F', arrowColor: '#2D6A4F' }}
          />
        </>
      )}

      {selectedDatum && (
        <>
          <Text style={styles.sectionTitle}>Odaberi vreme</Text>
          {slobodneSatnice.length === 0 ? (
            <Text style={styles.info}>Nema slobodnih termina za ovaj dan.</Text>
          ) : (
            <View style={styles.row}>
              {slobodneSatnice.map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.chip, selectedVreme === v && styles.chipSelected]}
                  onPress={() => setSelectedVreme(v)}
                >
                  <Text style={[styles.chipText, selectedVreme === v && styles.chipTextSelected]}>
                    {v}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      <TouchableOpacity style={styles.bookButton} onPress={handleBooking}>
        <Text style={styles.bookButtonText}>Potvrdi rezervaciju</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 15 },
  legenda: { fontSize: 12, color: '#666', marginBottom: 8 },
  info: { fontSize: 14, color: '#999', fontStyle: 'italic', marginTop: 5 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D6A4F',
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: '#2D6A4F' },
  chipText: { color: '#2D6A4F', fontWeight: '500' },
  chipTextSelected: { color: '#fff' },
  bookButton: {
    backgroundColor: '#2D6A4F',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 40,
  },
  bookButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
})

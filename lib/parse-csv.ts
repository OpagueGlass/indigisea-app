import { parse, ParseResult } from "papaparse"

/**
 * Word interface representing a single word/sentence entry in the CSV file. It includes:
 * - `id:` The provided id
 * - `word:` Text (word/sentence) in the national language
 * - `translatedWord:` An optional text in the native language, used only for audio-only collections.
 */
export interface Word {
  id: string
  word: string
  translatedWord?: string
}

/**
 * CollectionTypeValue type representing the two possible collection types:
 * - "transcript" for collections with transcripts and audio
 * - "audio" for audio-only collections with translations
 */
export const collectionTypes = [
  { value: "transcript", labelKey: "collectionTypes.transcriptWithAudio" },
  { value: "audio", labelKey: "collectionTypes.audioOnly" },
] as const

export type CollectionTypeValue = (typeof collectionTypes)[number]["value"]

/**
 * Updates the result of parsing a CSV file, handling errors and setting the parsed text into state based on the 
 * specified collection type. 
 * 
 * Note that the CSV format is based on the order of the columns and not the column names, where:
 * - The first column is the id
 * - The second column is the text (word/sentence) in the national language
 * - The third column (if present) is the translated text in the native language.
 * 
 * @param file The CSV file to be parsed.
 * @param collectionType The type of collection being created, either "transcript" or "audio".
 * @param setWords A callback function to set the parsed texts (words/sentences) into state.
 * @param onError A callback function to handle error messages, which can be used to display the error to the user.
 */
function updateResult(
  file: File,
  collectionType: CollectionTypeValue,
  setWords: (words: Word[]) => void,
  onError: (key: string, values?: Record<string, string>) => void
) {
  // Parses a single row of the CSV file into a Word object for transcript collections, which includes an id in the
  // first column and a word in the second column.
  const parseTranscriptRow = (row: string[]): Word => {
    return {
      id: row[0].trim(),
      word: row[1].trim(),
    }
  }

  // Parses a single row of the CSV file into a Word object for audio collections, which includes an id in the first
  // column, a word in the second column, and a translated word in the third column.
  const parseAudioRow = (row: string[]): Word => {
    return {
      id: row[0].trim(),
      word: row[1].trim(),
      translatedWord: row[2].trim(),
    }
  }

  return (results: ParseResult<unknown>) => {
    if (results.errors.length > 0) {
      // Display the parsing errors
      const errors = results.errors.map((e) => e.message).join(", ")
      onError("csv.errorParsing", { fileName: file.name, errors })
      return
    }

    try {
      // Extract the headers and data from the parsed results
      const headers = results.data[0] as string[]
      const data = results.data.slice(1) as string[][]

      if (data.length === 0) {
        // Show an error message if data is empty
        onError("csv.emptyFile", { fileName: file.name })
        return
      }

      // Filters valid rows with an id to remove any empty rows that may have been included in the CSV file, which can
      // occur if the user accidentally adds extra lines at the end of the file.
      const validRows = data.filter((row) => row[0].length > 0)

      if (collectionType === "audio") {
        // Check if the audio collection has at least 3 columns (id, word, translatedWord) and parse the valid rows
        // into Word objects.
        if (headers.length < 3) {
          onError("csv.needs3ColumnsAudio", { fileName: file.name })
          return
        }
        const words = validRows.map(parseAudioRow)
        setWords(words)
      } else if (collectionType === "transcript") {
        // Check if the transcript collection has at least 2 columns (id, word) and parse the valid rows into Word objects.
        if (headers.length < 2) {
          onError("csv.needs2ColumnsTranscript", { fileName: file.name })
          return
        }
        const words = validRows.map(parseTranscriptRow)
        setWords(words)
      }
    } catch (error) {
      // Handle any unexpected errors that may occur during parsing and display an error message to the user.
      const message = (error as Error).message
      onError("csv.unexpectedError", { fileName: file.name, message })
      return
    }
  }
}

/**
 * Parses a CSV file into an array of Word objects based on the specified collection type with the PapaParse library,
 * handling errors and providing user feedback through toast notifications.
 *
 * @param file The CSV file to be parsed.
 * @param collectionType The type of collection being created, either "transcript" or "audio".
 * @param setWords A callback function to set the parsed texts (words/sentences) into state.
 * @param onError A callback function to handle error messages, which can be used to display the error to the user.
 */
export function parseCSVFile(
  file: File,
  collectionType: CollectionTypeValue,
  setWords: (words: Word[]) => void,
  onError: (key: string, values?: Record<string, string>) => void
) {
  // Fix the delimiter to a comma and auto-detect the newline character, headers as false to return the raw data as a 2D
  // array, and use the updateResult function to handle the parsed results and errors.
  parse(file, {
    delimiter: ",",
    header: false,
    complete: updateResult(file, collectionType, setWords, onError),
  })
}

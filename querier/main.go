package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"

	_ "github.com/mattn/go-sqlite3"
)

type TimeSeriesResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	Meta    struct {
		Symbol   string `json:"symbol"`
		Interval string `json:"interval"`
	} `json:"meta"`
	Data []struct {
		Datetime string `json:"datetime"`
		Open     string `json:"open"`
		High     string `json:"high"`
		Low      string `json:"low"`
		Close    string `json:"close"`
		Volume   string `json:"volume"`
	} `json:"values"`
}

func initDB(dbPath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS stock_prices (
		id        INTEGER PRIMARY KEY AUTOINCREMENT,
		symbol    TEXT    NOT NULL,
		interval  TEXT    NOT NULL,
		datetime  TEXT    NOT NULL,
		open      TEXT    NOT NULL,
		high      TEXT    NOT NULL,
		low       TEXT    NOT NULL,
		close     TEXT    NOT NULL,
		volume    TEXT    NOT NULL,
		UNIQUE(symbol, interval, datetime)
	)`)
	if err != nil {
		return nil, err
	}
	return db, nil
}

func storeData(db *sql.DB, symbol, interval string, data []struct {
	Datetime string `json:"datetime"`
	Open     string `json:"open"`
	High     string `json:"high"`
	Low      string `json:"low"`
	Close    string `json:"close"`
	Volume   string `json:"volume"`
}) error {
	stmt, err := db.Prepare(`INSERT OR REPLACE INTO stock_prices
		(symbol, interval, datetime, open, high, low, close, volume)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, d := range data {
		if _, err := stmt.Exec(symbol, interval, d.Datetime, d.Open, d.High, d.Low, d.Close, d.Volume); err != nil {
			return err
		}
	}
	return nil
}

func main() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "/data/stocks.db"
	}

	apiKey := os.Getenv("TWELVEDATA_API_KEY")
	if apiKey == "" {
		log.Fatal("TWELVEDATA_API_KEY environment variable is not set")
	}

	db, err := initDB(dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	symbol := "AAPL"
	interval := "1min"
	url := fmt.Sprintf("https://api.twelvedata.com/time_series?symbol=%s&interval=%s&apikey=%s", symbol, interval, apiKey)

	resp, err := http.Get(url)
	if err != nil {
		log.Fatal(err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Fatal(err)
	}

	var response TimeSeriesResponse
	if err := json.Unmarshal(body, &response); err != nil {
		log.Fatal(err)
	}
	if response.Status != "ok" {
		log.Fatalf("API error: %s\n", response.Message)
	}

	fmt.Printf("Time Series for symbol: %s\n", response.Meta.Symbol)
	for _, data := range response.Data {
		fmt.Printf("Time: %s, Open: %s, High: %s, Low: %s, Close: %s, Volume: %s\n",
			data.Datetime, data.Open, data.High, data.Low, data.Close, data.Volume)
	}

	if err := storeData(db, response.Meta.Symbol, response.Meta.Interval, response.Data); err != nil {
		log.Fatalf("Failed to store data: %v", err)
	}
	log.Printf("Stored %d records for %s into %s\n", len(response.Data), response.Meta.Symbol, dbPath)
}
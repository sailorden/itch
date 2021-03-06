package main

import (
	"fmt"
	"log"
	"strings"
	"time"

	gs "github.com/fasterthanlime/go-selenium"
	"github.com/go-errors/errors"
)

// SLEEP is the amount of time the driver will sleep between each
// attempt at checking that something we're waiting for has happened
const SLEEP = 100 * time.Millisecond

// TIMEOUT is the total amount of time we're willing to wait until
// something happens
const TIMEOUT = 15 * time.Second

// LOG_PERF can be set to true if one wants to log all requests
const LOG_PERF = false

func (r *runner) setValue(selector string, value string) error {
	if LOG_PERF {
		startTime := time.Now()
		defer func() {
			log.Printf("setValue ran in %s", time.Since(startTime))
		}()
	}

	d := r.driver

	err := r.waitForVisible(selector)
	if err != nil {
		return errors.Wrap(err, 0)
	}

	by := gs.ByCSSSelector(selector)
	el, err := d.FindElement(by)
	if err != nil {
		return errors.Wrap(err, 0)
	}

	_, err = el.Clear()
	if err != nil {
		return errors.Wrap(err, 0)
	}

	_, err = el.SendKeys(value)
	if err != nil {
		return errors.Wrap(err, 0)
	}

	return nil
}

func (r *runner) click(selector string) error {
	if LOG_PERF {
		startTime := time.Now()
		defer func() {
			log.Printf("click ran in %s", time.Since(startTime))
		}()
	}

	return r.clickWithTimeout(selector, TIMEOUT)
}

func (r *runner) clickWithTimeout(selector string, timeout time.Duration) error {
	if LOG_PERF {
		startTime := time.Now()
		defer func() {
			log.Printf("clickWithTimeout ran in %s", time.Since(startTime))
		}()
	}

	d := r.driver

	err := r.waitForVisibleWithTimeout(selector, timeout)
	if err != nil {
		return errors.Wrap(err, 0)
	}

	by := gs.ByCSSSelector(selector)
	el, err := d.FindElement(by)
	if err != nil {
		return errors.Wrap(err, 0)
	}

	_, err = el.Click()
	if err != nil {
		return errors.Wrap(err, 0)
	}

	return nil
}

func (r *runner) moveTo(selector string) error {
	if LOG_PERF {
		startTime := time.Now()
		defer func() {
			log.Printf("moveTo ran in %s", time.Since(startTime))
		}()
	}

	d := r.driver

	err := r.waitForVisible(selector)
	if err != nil {
		return errors.Wrap(err, 0)
	}

	by := gs.ByCSSSelector(selector)
	el, err := d.FindElement(by)
	if err != nil {
		return errors.Wrap(err, 0)
	}

	_, err = el.MoveTo(0, 0)
	if err != nil {
		return errors.Wrap(err, 0)
	}

	return nil
}

func (r *runner) waitUntilTextExists(selector string, value string) error {
	if LOG_PERF {
		startTime := time.Now()
		defer func() {
			log.Printf("waitUntilTextExists ran in %s", time.Since(startTime))
		}()
	}

	return r.waitUntilTextExistsWithTimeout(selector, value, TIMEOUT)
}

func (r *runner) waitUntilTextExistsWithTimeout(selector string, value string, timeout time.Duration) error {
	if LOG_PERF {
		startTime := time.Now()
		defer func() {
			log.Printf("waitUntilTextExistsWithTimeout ran in %s", time.Since(startTime))
		}()
	}

	d := r.driver

	err := r.waitForVisible(selector)
	if err != nil {
		return errors.Wrap(err, 0)
	}

	by := gs.ByCSSSelector(selector)
	found := d.Wait(func(w gs.WebDriver) bool {
		el, err := w.FindElement(by)
		if err != nil {
			return false
		}

		text, err := el.Text()
		if err != nil {
			return false
		}

		return strings.Contains(text.Text, value)
	}, timeout, SLEEP)
	if !found {
		return errors.Wrap(fmt.Errorf("timed out waiting for %s to have text '%s'", selector, value), 0)
	}

	return nil
}

func (r *runner) waitForVisible(selector string) error {
	if LOG_PERF {
		startTime := time.Now()
		defer func() {
			log.Printf("waitForVisible ran in %s", time.Since(startTime))
		}()
	}

	return r.waitForVisibleWithTimeout(selector, TIMEOUT)
}

func (r *runner) waitForVisibleWithTimeout(selector string, timeout time.Duration) error {
	if LOG_PERF {
		startTime := time.Now()
		defer func() {
			log.Printf("waitForVisibleWithTimeout ran in %s", time.Since(startTime))
		}()
	}

	d := r.driver

	by := gs.ByCSSSelector(selector)

	found := d.Wait(func(w gs.WebDriver) bool {
		el, err := w.FindElement(by)
		if err != nil {
			return false
		}

		res, err := el.Displayed()
		if err != nil {
			return false
		}

		return res.Displayed
	}, timeout, SLEEP)

	if !found {
		return errors.Wrap(fmt.Errorf("timed out waiting for %s to be visible", selector), 0)
	}

	return nil
}

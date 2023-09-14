class ObservationLoggingService {
  observationsByService = { data: { rows: [] } };
  serviceId = '';
  #authToken = '';

  constructor(loggingServiceURL, serviceId) {
    this.loggingServiceURL = loggingServiceURL;
    this.serviceId = serviceId;
  }

  async loadObservations() {
    await this.#getAuthToken();
    this.observationsByService = await this.getObservationsForService(this.serviceId);
  }

  #getFinalBody(data) {
    return {
      meta: {
        email: 'user@example.com',
        'request-id': 'electron-smartsheet-dev-ae6a9dd1-9e0b-4ba0-bacd-6abbdec241f6',
      },
      ...data,
    };
  }

  async getObservationsForService(serviceId) {
    const observationResponse = await fetch(`${this.loggingServiceURL}/observations?team_id=${serviceId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + this.#authToken,
      },
    });
    return await observationResponse.json();
  }

  async addObservation(body) {
    const observationResponse = await fetch(`${this.loggingServiceURL}/observation`, {
      method: 'POST',
      body: JSON.stringify(this.#getFinalBody(body)),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + this.#authToken,
      },
    });
    const observation = await observationResponse.json();
    this.observationsByService.data.rows.push(observation.data);
    return observation;
  }

  async updateObservation(body, id) {
    const observationResponse = await fetch(`${this.loggingServiceURL}/observation/${id}`, {
      method: 'PUT',
      body: JSON.stringify(this.#getFinalBody(body)),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + this.#authToken,
      },
    });
    const observation = await observationResponse.json();
    const foundObservation = this.observationsByService.data.rows.find((o) => o.id.toString() === id);
    Object.assign(foundObservation, observation.data);
    return observation;
  }

  async #getAuthToken() {
    const authBody = {
      data: {
        login: 'shewhart',
        password: 'MRlAOJxwJbqyK8',
      },
    };
    const authResponse = await fetch(`${this.loggingServiceURL}/getToken`, {
      method: 'POST',
      body: JSON.stringify(this.#getFinalBody(authBody)),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await authResponse.json();
    this.#authToken = result.data.token;
  }
}

export default ObservationLoggingService;

export class ObservationLoggingService {
  observationsByService = { data: { rows: [] } };
  btoaToken = '';
  serviceId = '';

  constructor(loggingServiceURL, btoaToken, serviceId) {
    this.loggingServiceURL = loggingServiceURL;
    this.serviceId = serviceId;
    this.btoaToken = btoaToken;
  }

  getAuthToken() {
    let token = atob(this.btoaToken);
    token = token.startsWith('prod') ? token.split('prod: ')[1] : token;
    return token;
  }

  async loadObservations() {
    this.observationsByService = await this.getObservationsForService(this.serviceId);
  }

  async getObservationsForService(serviceId) {
    const observationResponse = await fetch(`${this.loggingServiceURL}/observations?team_id=${serviceId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.getAuthToken(),
      },
    });
    if (!observationResponse.ok) {
      throw new Error(`Error: ${observationResponse.status} - ${observationResponse.statusText}`);
    }
    return await observationResponse.json();
  }

  async addObservation(body) {
    const observationResponse = await fetch(`${this.loggingServiceURL}/observation`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.getAuthToken(),
      },
    });
    if (!observationResponse.ok) {
      throw new Error(`Error: ${observationResponse.status} - ${observationResponse.statusText}`);
    }
    const observation = await observationResponse.json();
    this.observationsByService.data.push(observation.data);
    return observation;
  }

  async updateObservation(body, id) {
    const observationResponse = await fetch(`${this.loggingServiceURL}/observation/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.getAuthToken(),
      },
    });
    if (!observationResponse.ok) {
      throw new Error(`Error: ${observationResponse.status} - ${observationResponse.statusText}`);
    }
    const observation = await observationResponse.json();
    const foundObservation = this.observationsByService.data.find((o) => o.id.toString() === id);
    Object.assign(foundObservation, observation.data);
    return observation;
  }
}

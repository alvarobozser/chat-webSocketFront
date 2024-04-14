import { Component } from '@angular/core';
import { Client } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import { Mensaje } from './models/mensaje';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent {

  private client!: Client;

  conectado: boolean = false;

  mensaje: Mensaje = new Mensaje();
  mensajes: Mensaje[] = [];

  escribiendo!: string;
  clienteId: string;

  constructor() {
    this.clienteId = 'id-' + new Date().getTime() + '-' + Math.random().toString(36).substr(2);
  }

  ngOnInit() {
    // Inicializa el cliente WebSocket y establece la WebSocket para conectarlo al servidor
    this.client = new Client();
    this.client.webSocketFactory = () => {
      return new SockJS("http://localhost:8080/chat-webSocket");
    }

    // Define la acción a realizar cuando se conecta el cliente al servidor
    this.client.onConnect = (frame) => {
      console.log('Conectados: ' + this.client.connected + ' : ' + frame);
      this.conectado = true;

      // Suscribe el cliente a los mensajes entrantes del chat
      this.client.subscribe('/chat/mensaje', e => {
        // Parsea el mensaje JSON recibido y lo convierte en objeto Mensaje
        let mensaje: Mensaje = JSON.parse(e.body) as Mensaje;
        // Convierte la fecha del mensaje a un objeto Date
        mensaje.fecha = new Date(mensaje.fecha);

        // Verifica si es un nuevo usuario y asigna un color si corresponde
        if (!this.mensaje.color && mensaje.tipo == 'NUEVO_USUARIO' &&
          this.mensaje.username == mensaje.username) {
          this.mensaje.color = mensaje.color;
        }

        // Añade el mensaje al arreglo de mensajes y lo muestra en la consola
        this.mensajes.push(mensaje);
        console.log(mensaje);
      });

      // Suscribe el cliente a eventos de "escribiendo" del chat
      this.client.subscribe('/chat/escribiendo', e => {
        // Actualiza el estado de "escribiendo" y lo reinicia después de 3 segundos
        this.escribiendo = e.body;
        setTimeout(() => this.escribiendo = '', 3000)
      });

      // Obtiene el historial de mensajes del usuario actual
      console.log(this.clienteId);
      this.client.subscribe('/chat/historial/' + this.clienteId, e => {
        // Parsea el historial de mensajes recibido y lo asigna al arreglo de mensajes
        const historial = JSON.parse(e.body) as Mensaje[];
        this.mensajes = historial.map(m => {
          m.fecha = new Date(m.fecha);
          return m;
        }).reverse();
      });

      // Publica un mensaje para solicitar el historial de mensajes
      this.client.publish({ destination: '/app/historial', body: this.clienteId });

      // Configura el mensaje como "NUEVO_USUARIO" y lo publica
      this.mensaje.tipo = 'NUEVO_USUARIO';
      this.client.publish({ destination: '/app/mensaje', body: JSON.stringify(this.mensaje) });
    }

    // Define la acción a realizar cuando se desconecta el cliente del servidor
    this.client.onDisconnect = (frame) => {
      console.log('Desconectados: ' + !this.client.connected + ' : ' + frame);
      this.conectado = false;
      // Reinicia el mensaje y el arreglo de mensajes al desconectarse
      this.mensaje = new Mensaje();
      this.mensajes = [];
    }
  }

  // Conecta el cliente WebSocket al servidor
  conectar(): void {
    this.client.activate();
  }

  // Desconecta el cliente WebSocket del servidor
  desconectar(): void {
    this.client.deactivate();
  }

  // Envia un mensaje al servidor
  enviarMensaje(): void {
    // Configura el tipo de mensaje como "MENSAJE" y lo publica
    this.mensaje.tipo = 'MENSAJE';
    this.client.publish({ destination: '/app/mensaje', body: JSON.stringify(this.mensaje) });
    // Limpia el campo de texto del mensaje después de enviarlo
    this.mensaje.texto = '';
  }

  // Envía un evento de "escribiendo" al servidor
  escribiendoEvento(): void {
    this.client.publish({ destination: '/app/escribiendo', body: this.mensaje.username });
  }

}
